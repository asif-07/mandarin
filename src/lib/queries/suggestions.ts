import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { todayISO } from "@/lib/format";
import type { SuggestGroup, SuggestTraveller } from "@/lib/travel/suggestions";
import type { ApplicationKind } from "@/lib/apply/shared";

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
    supabase.from("travellers").select("id, full_name, traveller_ref, travel_start_date, travel_end_date, source, portal_application_id").is("travel_group_id", null).neq("status", "cancelled").neq("status", "travelled").gte("travel_start_date", today).order("travel_start_date").limit(500),
  ]);
  return {
    groups: (groups ?? []).map((g) => ({ id: g.id, group_ref: g.group_ref, label: g.label, travel_date: g.travel_date, travel_end_date: g.travel_end_date, visa_status: g.visa_status, pax: g.travellers.filter((t) => t.status !== "cancelled").length })),
    ungrouped: (travellers ?? []).map((t) => ({ id: t.id, full_name: t.full_name, traveller_ref: t.traveller_ref, travel_start_date: t.travel_start_date, travel_end_date: t.travel_end_date, source: t.source, application_id: t.portal_application_id })),
  };
}

export type ApplicationPassenger = {
  id: string;
  traveller_ref: string;
  full_name: string;
  passport_number: string | null;
  pan_number: string | null;
  address: string | null;
  nationality: string | null;
  status: string;
  travel_group_id: string | null;
  group_ref: string | null;
  doc_types: string[];
};

export type ApplicationRow = {
  id: string;
  token: string;
  kind: ApplicationKind;
  contact_name: string;
  contact_phone: string | null;
  contact_email: string | null;
  agency_name: string | null;
  nationality: string | null;
  travel_start_date: string;
  travel_end_date: string;
  status: string;
  submitted_at: string | null;
  ready: boolean;
  travel_group_id: string | null;
  group_ref: string | null;
  created_at: string;
  passengers: ApplicationPassenger[];
};

/** Portal applications (customers and agents), newest submissions first, with their passengers. */
export async function listApplications(supabase: Client, opts: { status?: string; kind?: string; q?: string; limit?: number } = {}): Promise<ApplicationRow[]> {
  let q = supabase
    .from("portal_applications")
    .select("id, token, kind, contact_name, contact_phone, contact_email, agency_name, nationality, travel_start_date, travel_end_date, status, submitted_at, ready, travel_group_id, created_at, group:travel_groups(group_ref), travellers(id, traveller_ref, full_name, passport_number, pan_number, address, nationality, status, travel_group_id, created_at, group:travel_groups(group_ref), traveller_documents(doc_type, deleted_at))")
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 200);
  if (opts.status) q = q.eq("status", opts.status);
  if (opts.kind === "b2c" || opts.kind === "b2b") q = q.eq("kind", opts.kind);
  if (opts.q) {
    const like = `%${opts.q.replace(/[%,()]/g, "")}%`;
    q = q.or(`contact_name.ilike.${like},agency_name.ilike.${like},contact_phone.ilike.${like},contact_email.ilike.${like}`);
  }
  const { data } = await q;
  return (data ?? []).map((a) => ({
    id: a.id,
    token: a.token,
    kind: a.kind === "b2b" ? "b2b" : "b2c",
    contact_name: a.contact_name,
    contact_phone: a.contact_phone,
    contact_email: a.contact_email,
    agency_name: a.agency_name,
    nationality: a.nationality,
    travel_start_date: a.travel_start_date,
    travel_end_date: a.travel_end_date,
    status: a.status,
    submitted_at: a.submitted_at,
    ready: a.ready,
    travel_group_id: a.travel_group_id,
    group_ref: a.group?.group_ref ?? null,
    created_at: a.created_at,
    passengers: [...a.travellers]
      .filter((t) => t.status !== "cancelled")
      .sort((x, y) => (x.created_at ?? "").localeCompare(y.created_at ?? ""))
      .map((t) => ({
        id: t.id,
        traveller_ref: t.traveller_ref,
        full_name: t.full_name,
        passport_number: t.passport_number,
        pan_number: t.pan_number,
        address: t.address,
        nationality: t.nationality,
        status: t.status,
        travel_group_id: t.travel_group_id,
        group_ref: t.group?.group_ref ?? null,
        doc_types: [...new Set(t.traveller_documents.filter((d) => !d.deleted_at).map((d) => d.doc_type))],
      })),
  }));
}
