import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { groupRef } from "@/lib/queries/travel";

/** Everything the three sides (company, partner portal, visa team) show for a group in the workflow. */
export const WORKFLOW_GROUP_SELECT =
  "id, group_ref, group_code, reference_prefix, travel_date, travel_end_date, label, notes, source, partner_code, pax_expected, entry_port, exit_port, package_tier, hotel_name, workflow_status, workflow_updated_at, submitted_by_partner, submitted_at, arrival_flight_date, arrival_flight_time, arrival_flight_no, departure_flight_date, departure_flight_time, departure_flight_no, other_border_requested, other_border_note, company_decision_note, company_approved_at, visa_processing_started_at, visa_issued_at, visa_approved_at, visa_emailed_at, visa_status, visa_path, visa_file_name, visa_uploaded_at, pack_path, pack_file_name, pack_uploaded_at, guide_id, guide_name, guide_phone, guide_notes, destination, vehicle_notes, stamped_visa_path, stamped_visa_file_name, stamped_visa_uploaded_at, stamped_visa_uploaded_by, stamped_visa_shared, china_entry_at, china_entry_confirmed_by, china_exit_at, china_exit_confirmed_by, completed_at, created_at, travellers(count), guide:guides(id, name, phone, role, languages, notes)";

export type WorkflowGroup = {
  id: string;
  group_ref: string;
  group_code: string;
  reference_prefix: string;
  travel_date: string;
  travel_end_date: string;
  label: string | null;
  notes: string | null;
  source: string;
  partner_code: string | null;
  partner_name: string | null;
  partner_email: string | null;
  pax_expected: number | null;
  traveller_count: number;
  entry_port: string | null;
  exit_port: string | null;
  package_tier: string | null;
  hotel_name: string | null;
  workflow_status: string | null;
  workflow_updated_at: string | null;
  submitted_by_partner: boolean;
  submitted_at: string | null;
  arrival_flight_date: string | null;
  arrival_flight_time: string | null;
  arrival_flight_no: string | null;
  departure_flight_date: string | null;
  departure_flight_time: string | null;
  departure_flight_no: string | null;
  other_border_requested: boolean;
  other_border_note: string | null;
  company_decision_note: string | null;
  company_approved_at: string | null;
  visa_processing_started_at: string | null;
  visa_issued_at: string | null;
  visa_approved_at: string | null;
  visa_emailed_at: string | null;
  visa_status: string;
  visa_path: string | null;
  visa_file_name: string | null;
  visa_uploaded_at: string | null;
  pack_path: string | null;
  pack_file_name: string | null;
  pack_uploaded_at: string | null;
  guide_id: string | null;
  guide_name: string | null;
  guide_phone: string | null;
  guide_notes: string | null;
  guide: { id: string; name: string; phone: string | null; role: string; languages: string | null; notes: string | null } | null;
  destination: string | null;
  vehicle_notes: string | null;
  stamped_visa_path: string | null;
  stamped_visa_file_name: string | null;
  stamped_visa_uploaded_at: string | null;
  stamped_visa_uploaded_by: string | null;
  stamped_visa_shared: boolean;
  china_entry_at: string | null;
  china_entry_confirmed_by: string | null;
  china_exit_at: string | null;
  china_exit_confirmed_by: string | null;
  completed_at: string | null;
  created_at: string | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapGroup(r: any): WorkflowGroup {
  const { travellers, guide, ...rest } = r;
  return {
    ...rest,
    group_ref: r.group_ref ?? groupRef(r),
    partner_name: null,
    partner_email: null,
    traveller_count: Array.isArray(travellers) ? Number(travellers[0]?.count ?? 0) : 0,
    guide: guide ?? null,
    arrival_flight_time: r.arrival_flight_time ? String(r.arrival_flight_time).slice(0, 5) : null,
    departure_flight_time: r.departure_flight_time ? String(r.departure_flight_time).slice(0, 5) : null,
  };
}

/** Fill partner name / email from the partner master (no foreign key links the two tables). */
async function withPartners(groups: WorkflowGroup[]): Promise<WorkflowGroup[]> {
  const codes = [...new Set(groups.map((g) => g.partner_code).filter((c): c is string => !!c))];
  if (codes.length === 0) return groups;
  const supabase = createAdminClient();
  const { data } = await supabase.from("b2b_partners").select("code, name, email").in("code", codes);
  const byCode = new Map((data ?? []).map((p) => [p.code, p]));
  return groups.map((g) => (g.partner_code && byCode.get(g.partner_code) ? { ...g, partner_name: byCode.get(g.partner_code)!.name, partner_email: byCode.get(g.partner_code)!.email } : g));
}

export async function loadWorkflowGroup(id: string): Promise<WorkflowGroup | null> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("travel_groups").select(WORKFLOW_GROUP_SELECT).eq("id", id).maybeSingle();
  if (!data) return null;
  const [g] = await withPartners([mapGroup(data)]);
  return g ?? null;
}

/** A partner's own groups: those they submitted plus any group filed under their code. */
export async function listPartnerGroups(partnerCode: string): Promise<WorkflowGroup[]> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("travel_groups").select(WORKFLOW_GROUP_SELECT).eq("partner_code", partnerCode).order("travel_date", { ascending: false }).limit(300);
  return withPartners((data ?? []).map(mapGroup));
}

/** Groups in the visa team's hands: approved by the company and onward. */
export async function listVisaTeamGroups(): Promise<WorkflowGroup[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("travel_groups")
    .select(WORKFLOW_GROUP_SELECT)
    .in("workflow_status", ["company_approved", "visa_processing", "visa_issued", "visa_approved", "guide_assigned", "travelling_to_china", "entry_evidence_uploaded", "travelling_in_china", "china_exited", "completed"])
    .order("travel_date", { ascending: true })
    .limit(500);
  return withPartners((data ?? []).map(mapGroup));
}

/** Every group with a workflow status, for the company's workflow board. */
export async function listCompanyWorkflowGroups(): Promise<WorkflowGroup[]> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("travel_groups").select(WORKFLOW_GROUP_SELECT).not("workflow_status", "is", null).order("workflow_updated_at", { ascending: false }).limit(500);
  return withPartners((data ?? []).map(mapGroup));
}

export type GroupEvent = { id: string; at: string; actor_kind: string; actor_name: string | null; event: string; status: string | null; note: string | null };

export async function listEvents(groupId: string): Promise<GroupEvent[]> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("group_events").select("id, at, actor_kind, actor_name, event, status, note").eq("group_id", groupId).order("at", { ascending: false }).limit(200);
  return data ?? [];
}

export type NotifyAudience = { audience: "company" | "visa_team" } | { audience: "partner"; partner_code: string };
export type NotificationRow = { id: string; group_id: string | null; title: string; body: string | null; created_at: string; read_at: string | null; email_status: string | null; email_error: string | null; email_to: string | null; group_ref: string | null };

function scope<T extends { eq: (c: string, v: string) => T }>(q: T, target: NotifyAudience): T {
  const base = q.eq("audience", target.audience);
  return target.audience === "partner" ? base.eq("partner_code", target.partner_code) : base;
}

export async function listNotifications(target: NotifyAudience, limit = 50): Promise<NotificationRow[]> {
  const supabase = createAdminClient();
  let q = supabase.from("notifications").select("id, group_id, title, body, created_at, read_at, email_status, email_error, email_to, group:travel_groups(group_ref)").order("created_at", { ascending: false }).limit(limit);
  q = scope(q, target);
  const { data } = await q;
  return (data ?? []).map((n) => ({ ...n, group_ref: n.group?.group_ref ?? null, group: undefined }) as NotificationRow);
}

export async function unreadCount(target: NotifyAudience): Promise<number> {
  const supabase = createAdminClient();
  let q = supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
  q = scope(q, target);
  const { count } = await q;
  return count ?? 0;
}

export async function markNotificationsRead(target: NotifyAudience): Promise<void> {
  const supabase = createAdminClient();
  let q = supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
  q = scope(q, target);
  await q;
}
