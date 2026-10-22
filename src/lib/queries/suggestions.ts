import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { todayISO } from "@/lib/format";
import type { SuggestGroup, SuggestTraveller } from "@/lib/travel/suggestions";

type Client = SupabaseClient<Database>;

/**
 * Inputs for group suggestions: our own upcoming groups (not partner
 * groups) with their pax, and every ungrouped upcoming traveller who could
 * be paired up. One query each, shared by the applications page, the
 * traveller page and the dashboard.
 */
export async function loadSuggestionInputs(supabase: Client): Promise<{ groups: SuggestGroup[]; ungrouped: SuggestTraveller[] }> {
  const today = todayISO();
  const [{ data: groups }, { data: travellers }] = await Promise.all([
    supabase.from("travel_groups").select("id, group_ref, label, travel_date, travel_end_date, visa_status, source, partner_code, travellers(status)").eq("source", "internal").is("partner_code", null).gte("travel_end_date", today).order("travel_date").limit(300),
    supabase.from("travellers").select("id, full_name, traveller_ref, travel_start_date, travel_end_date, source").is("travel_group_id", null).neq("status", "cancelled").neq("status", "travelled").gte("travel_start_date", today).order("travel_start_date").limit(500),
  ]);
  return {
    groups: (groups ?? []).map((g) => ({ id: g.id, group_ref: g.group_ref, label: g.label, travel_date: g.travel_date, travel_end_date: g.travel_end_date, visa_status: g.visa_status, pax: g.travellers.filter((t) => t.status !== "cancelled").length })),
    ungrouped: (travellers ?? []).map((t) => ({ id: t.id, full_name: t.full_name, traveller_ref: t.traveller_ref, travel_start_date: t.travel_start_date, travel_end_date: t.travel_end_date, source: t.source })),
  };
}

export type ApplicationRow = {
  id: string;
  traveller_ref: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  nationality: string | null;
  passport_number: string | null;
  pan_number: string | null;
  address: string | null;
  travel_start_date: string;
  travel_end_date: string;
  travel_group_id: string | null;
  group_ref: string | null;
  status: string;
  portal_status: string | null;
  portal_submitted_at: string | null;
  portal_ready: boolean;
  portal_token: string | null;
  created_at: string | null;
  doc_types: string[];
};

/** Customer portal applications, newest submissions first. */
export async function listApplications(supabase: Client, opts: { status?: string; q?: string; limit?: number } = {}): Promise<ApplicationRow[]> {
  let q = supabase
    .from("travellers")
    .select("id, traveller_ref, full_name, phone, email, nationality, passport_number, pan_number, address, travel_start_date, travel_end_date, travel_group_id, status, portal_status, portal_submitted_at, portal_ready, portal_token, created_at, group:travel_groups(group_ref), traveller_documents(doc_type, deleted_at)")
    .eq("source", "b2c_portal")
    .order("portal_submitted_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 300);
  if (opts.status) q = q.eq("portal_status", opts.status);
  if (opts.q) {
    const like = `%${opts.q.replace(/[%,()]/g, "")}%`;
    q = q.or(`full_name.ilike.${like},traveller_ref.ilike.${like},passport_number.ilike.${like},phone.ilike.${like},email.ilike.${like}`);
  }
  const { data } = await q;
  return (data ?? []).map((t) => ({
    id: t.id,
    traveller_ref: t.traveller_ref,
    full_name: t.full_name,
    phone: t.phone,
    email: t.email,
    nationality: t.nationality,
    passport_number: t.passport_number,
    pan_number: t.pan_number,
    address: t.address,
    travel_start_date: t.travel_start_date,
    travel_end_date: t.travel_end_date,
    travel_group_id: t.travel_group_id,
    group_ref: t.group?.group_ref ?? null,
    status: t.status,
    portal_status: t.portal_status,
    portal_submitted_at: t.portal_submitted_at,
    portal_ready: t.portal_ready,
    portal_token: t.portal_token,
    created_at: t.created_at,
    doc_types: [...new Set(t.traveller_documents.filter((d) => !d.deleted_at).map((d) => d.doc_type))],
  }));
}
