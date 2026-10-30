import {
  dbError,
  failure,
  isConfigured,
  response,
  serverSupabase,
} from "@/lib/supabase";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { ApiError } from "@/lib/supabase";
import type {
  Connection,
  Membership,
  MembershipPeriod,
  MembershipRequest,
  Profile,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!isConfigured())
      return response({
        configured: false,
        user: null,
        profile: null,
        membership: null,
        connections: [],
      });
    const supabase = await serverSupabase();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (
      authError &&
      (isAuthRetryableFetchError(authError) ||
        authError.status === 429 ||
        (authError.status ?? 0) >= 500)
    ) {
      throw new ApiError(
        "Your session could not be checked. Please try again.",
        503,
      );
    }
    if (!user)
      return response({
        configured: true,
        user: null,
        profile: null,
        membership: null,
        connections: [],
      });
    const results = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase
        .from("member_accounts")
        .select(
          "member_type,preferred_plan,moderation_status,moderation_reason",
        )
        .eq("user_id", user.id)
        .single(),
      supabase
        .from("membership_periods")
        .select("id,plan,amount_rmb,starts_at,expires_at")
        .eq("user_id", user.id)
        .order("expires_at", { ascending: false }),
      supabase
        .from("membership_requests")
        .select(
          "id,user_id,plan,reference,note,status,rejection_reason,created_at,reviewed_at",
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30),
      supabase
        .from("connections")
        .select(
          "id,sender_id,recipient_id,message,status,created_at,updated_at",
        )
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("reviews")
        .select("connection_id")
        .eq("reviewer_id", user.id),
    ]);
    results.forEach(({ error }) => dbError(error));
    const [
      profileResult,
      accountResult,
      periodsResult,
      requestsResult,
      connectionsResult,
      reviewsResult,
    ] = results;
    const periods = (periodsResult.data || []) as MembershipPeriod[];
    const now = Date.now();
    const current =
      periods.find(
        (period) =>
          new Date(period.starts_at).getTime() <= now &&
          new Date(period.expires_at).getTime() > now,
      ) || null;
    const profile = profileResult.data as Profile;
    const account = accountResult.data as Pick<
      Membership,
      | "member_type"
      | "preferred_plan"
      | "moderation_status"
      | "moderation_reason"
    >;
    const rows = (connectionsResult.data || []) as Array<
      Omit<Connection, "sender" | "recipient" | "reviewed" | "contact_email">
    >;
    const ids = [
      ...new Set(rows.flatMap((row) => [row.sender_id, row.recipient_id])),
    ];
    const peopleResult = ids.length
      ? await supabase
          .from("profiles")
          .select("id,full_name,avatar_url,company,city")
          .in("id", ids)
      : { data: [], error: null };
    dbError(peopleResult.error);
    const people = new Map(
      (peopleResult.data || []).map((person) => [person.id, person]),
    );
    const reviewed = new Set(
      (reviewsResult.data || []).map((review) => review.connection_id),
    );
    const contactIds = rows
      .filter((row) => row.status === "accepted" || row.status === "completed")
      .map((row) => row.id);
    const contactsResult = contactIds.length
      ? await supabase.rpc("connection_contacts", { targets: contactIds })
      : { data: [], error: null };
    dbError(contactsResult.error);
    const contacts = new Map(
      (
        (contactsResult.data || []) as Array<{
          connection_id: string;
          contact_email: string;
        }>
      ).map((item) => [item.connection_id, item.contact_email]),
    );
    return response({
      configured: true,
      user: {
        id: user.id,
        email: user.email || "",
        is_admin: user.app_metadata?.role === "admin",
      },
      profile,
      membership: {
        ...account,
        active: Boolean(current && account.moderation_status === "approved"),
        current,
        requests: (requestsResult.data || []) as MembershipRequest[],
      },
      connections: rows.map((row) => ({
        ...row,
        sender: people.get(row.sender_id) || null,
        recipient: people.get(row.recipient_id) || null,
        reviewed: reviewed.has(row.id),
        contact_email: contacts.get(row.id) || null,
      })),
    });
  } catch (error) {
    return failure(error);
  }
}
