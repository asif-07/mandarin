import {
  ApiError,
  administrator,
  dbError,
  failure,
  jsonBody,
  response,
  stringValue,
  uuidValue,
} from "@/lib/supabase";
import type { MembershipRequest, Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { supabase } = await administrator();
    const [accountResult, requestsResult, reviewsResult] = await Promise.all([
      supabase
        .from("member_accounts")
        .select("user_id,member_type,moderation_status")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("membership_requests")
        .select(
          "id,user_id,plan,reference,note,status,rejection_reason,created_at,reviewed_at",
        )
        .eq("status", "pending")
        .order("created_at")
        .limit(200),
      supabase
        .from("reviews")
        .select(
          "id,connection_id,reviewer_id,recipient_id,rating,body,status,created_at",
        )
        .eq("status", "pending")
        .order("created_at")
        .limit(200),
    ]);
    [accountResult, requestsResult, reviewsResult].forEach(({ error }) =>
      dbError(error),
    );
    const accounts = accountResult.data || [];
    const accountIds = accounts.map((account) => account.user_id);
    const ids = [
      ...new Set([
        ...accountIds,
        ...(requestsResult.data || []).map((item) => item.user_id),
        ...(reviewsResult.data || []).map((item) => item.reviewer_id),
      ]),
    ];
    const profilesResult = ids.length
      ? await supabase.from("profiles").select("*").in("id", ids)
      : { data: [], error: null };
    dbError(profilesResult.error);
    const profiles = new Map(
      (profilesResult.data || []).map((profile: Profile) => [
        profile.id,
        profile,
      ]),
    );
    const lanes = new Map(
      accounts.map((account) => [account.user_id, account.member_type]),
    );
    return response({
      profiles: accounts.flatMap((account) => {
        const profile = profiles.get(account.user_id);
        return profile
          ? [
              {
                ...profile,
                member_type: account.member_type,
                moderation_status: account.moderation_status,
              },
            ]
          : [];
      }),
      requests: (requestsResult.data || []).map((item: MembershipRequest) => ({
        ...item,
        full_name: profiles.get(item.user_id)?.full_name || "Member",
        member_type:
          lanes.get(item.user_id) ||
          (item.plan === "china_yearly" ? "china" : "global"),
      })),
      reviews: (reviewsResult.data || []).map((review) => ({
        ...review,
        reviewer_name:
          profiles.get(review.reviewer_id)?.full_name || "Global member",
      })),
    });
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await jsonBody(request);
    if (!["profile", "membership", "review"].includes(String(body.kind)))
      throw new ApiError("Choose a valid review queue.");
    if (!["approved", "rejected", "suspended"].includes(String(body.decision)))
      throw new ApiError("Choose a valid decision.");
    const { supabase } = await administrator();
    const { error } = await supabase.rpc("admin_decision", {
      entity_kind: body.kind,
      target: uuidValue(body.id),
      outcome: body.decision,
      decision_reason: stringValue(body.reason, "Decision reason", 1000, false),
    });
    dbError(error);
    return response({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
