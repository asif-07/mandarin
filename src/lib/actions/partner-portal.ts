"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPortalPartner, type PortalPartner } from "@/lib/portal/auth";
import { recordEvent, transition } from "@/lib/workflow/engine";
import { markNotificationsRead } from "@/lib/workflow/data";
import { checkSubmission } from "@/lib/workflow/rules";
import { STANDARD_BORDER } from "@/lib/constants";
import { groupRef } from "@/lib/queries/travel";
import { fail, ok, type ActionResult } from "@/lib/result";

async function requirePartner(): Promise<PortalPartner> {
  const p = await getPortalPartner();
  if (!p) throw new Error("Partner sign-in required");
  return p;
}

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date");
const timeStr = z.string().regex(/^\d{2}:\d{2}$/, "Enter a time (HH:MM)");
const optText = z
  .string()
  .trim()
  .max(500)
  .optional()
  .nullable()
  .transform((v) => v || null);

const groupInput = z.object({
  pax_expected: z.coerce.number().int().positive("How many pax?").max(999),
  travel_date: dateStr,
  travel_end_date: dateStr,
  other_border_requested: z.boolean().default(false),
  entry_port: z.string().trim().max(120).default(STANDARD_BORDER),
  exit_port: z.string().trim().max(120).default(STANDARD_BORDER),
  other_border_note: optText,
  arrival_flight_date: dateStr,
  arrival_flight_time: timeStr,
  arrival_flight_no: optText,
  departure_flight_date: dateStr,
  departure_flight_time: timeStr,
  departure_flight_no: optText,
  label: optText,
  notes: optText,
});
export type PartnerGroupInput = z.input<typeof groupInput>;

function ruleCheck(v: z.output<typeof groupInput>): string | null {
  const r = checkSubmission({ ...v, entry_port: v.other_border_requested ? v.entry_port : STANDARD_BORDER, exit_port: v.other_border_requested ? v.exit_port : STANDARD_BORDER });
  return r.blockers[0] ?? null;
}

/** Create a draft group for the signed-in partner. The Group ID is assigned at once (next free code on the entry date). */
export async function createPartnerGroup(input: PartnerGroupInput): Promise<ActionResult<{ id: string; group_ref: string }>> {
  const partner = await requirePartner();
  const parsed = groupInput.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check the details");
  const v = parsed.data;
  if (v.travel_end_date < v.travel_date) return fail("Exit date must be on or after the entry date");
  const entry = v.other_border_requested ? v.entry_port : STANDARD_BORDER;
  const exit = v.other_border_requested ? v.exit_port : STANDARD_BORDER;
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("create_b2b_group", {
    p: { travel_date: v.travel_date, travel_end_date: v.travel_end_date, reference_prefix: "MR144", partner_code: partner.code, partner_reference: null, pax_expected: v.pax_expected, label: v.label ?? `${partner.code} · ${v.pax_expected} pax`, notes: v.notes, entry_port: entry, exit_port: exit },
  });
  const row = data as { id?: string; group_code?: string } | null;
  if (error || !row?.id) return fail(error?.message ?? "Could not create the group");
  const { error: upErr } = await supabase
    .from("travel_groups")
    .update({
      workflow_status: "draft",
      workflow_updated_at: new Date().toISOString(),
      submitted_by_partner: true,
      other_border_requested: v.other_border_requested,
      other_border_note: v.other_border_requested ? v.other_border_note : null,
      arrival_flight_date: v.arrival_flight_date,
      arrival_flight_time: v.arrival_flight_time,
      arrival_flight_no: v.arrival_flight_no,
      departure_flight_date: v.departure_flight_date,
      departure_flight_time: v.departure_flight_time,
      departure_flight_no: v.departure_flight_no,
    })
    .eq("id", row.id);
  if (upErr) return fail(upErr.message);
  const { data: g } = await supabase.from("travel_groups").select("group_ref, reference_prefix, partner_code, travel_date, travel_end_date, group_code").eq("id", row.id).single();
  await recordEvent(supabase, row.id, { kind: "partner", name: partner.name }, "Draft created in the partner portal", { status: "draft" });
  return ok({ id: row.id, group_ref: g?.group_ref ?? (g ? groupRef(g) : row.id) });
}

/** Update a draft or correction-requested group. Dates and ports are kept in step with the Group ID by the database trigger. */
export async function updatePartnerGroup(groupId: string, input: PartnerGroupInput): Promise<ActionResult<{ id: string }>> {
  const partner = await requirePartner();
  const parsed = groupInput.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check the details");
  const v = parsed.data;
  const supabase = createAdminClient();
  const { data: g } = await supabase.from("travel_groups").select("id, partner_code, workflow_status").eq("id", groupId).maybeSingle();
  if (!g || g.partner_code !== partner.code) return fail("Group not found");
  if (!["draft", "correction_requested"].includes(g.workflow_status ?? "")) return fail("This group can no longer be edited");
  const { error } = await supabase
    .from("travel_groups")
    .update({
      pax_expected: v.pax_expected,
      travel_date: v.travel_date,
      travel_end_date: v.travel_end_date,
      entry_port: v.other_border_requested ? v.entry_port : STANDARD_BORDER,
      exit_port: v.other_border_requested ? v.exit_port : STANDARD_BORDER,
      other_border_requested: v.other_border_requested,
      other_border_note: v.other_border_requested ? v.other_border_note : null,
      arrival_flight_date: v.arrival_flight_date,
      arrival_flight_time: v.arrival_flight_time,
      arrival_flight_no: v.arrival_flight_no,
      departure_flight_date: v.departure_flight_date,
      departure_flight_time: v.departure_flight_time,
      departure_flight_no: v.departure_flight_no,
      label: v.label,
      notes: v.notes,
    })
    .eq("id", groupId);
  if (error) return fail(error.message);
  await recordEvent(supabase, groupId, { kind: "partner", name: partner.name }, "Group details updated");
  revalidatePath(`/partner/groups/${groupId}`);
  return ok({ id: groupId });
}

/** Submit: rules enforced again on the server, the pack must be uploaded, then the company is notified. */
export async function submitPartnerGroup(groupId: string): Promise<ActionResult<{ status: string }>> {
  const partner = await requirePartner();
  const supabase = createAdminClient();
  const { data: g } = await supabase
    .from("travel_groups")
    .select("id, partner_code, workflow_status, pack_path, travel_date, travel_end_date, entry_port, exit_port, other_border_requested, arrival_flight_date, arrival_flight_time, departure_flight_date, departure_flight_time, pax_expected")
    .eq("id", groupId)
    .maybeSingle();
  if (!g || g.partner_code !== partner.code) return fail("Group not found");
  if (!["draft", "correction_requested"].includes(g.workflow_status ?? "")) return fail("This group was already submitted");
  if (!g.pack_path) return fail("Upload the traveller documents (bulk PDF) before submitting");
  const check = checkSubmission({
    travel_date: g.travel_date,
    travel_end_date: g.travel_end_date,
    arrival_flight_date: g.arrival_flight_date,
    arrival_flight_time: g.arrival_flight_time ? String(g.arrival_flight_time).slice(0, 5) : null,
    departure_flight_date: g.departure_flight_date,
    departure_flight_time: g.departure_flight_time ? String(g.departure_flight_time).slice(0, 5) : null,
    entry_port: g.entry_port ?? "",
    exit_port: g.exit_port ?? "",
    other_border_requested: g.other_border_requested,
  });
  if (check.blockers.length) return fail(check.blockers[0]!);
  const res = await transition(groupId, "submitted", { kind: "partner", name: partner.name }, { note: g.other_border_requested ? "Other border requested: needs separate company approval" : null, patch: { submitted_at: new Date().toISOString(), submitted_by_partner: true } });
  if (!res.ok) return fail(res.error);
  revalidatePath("/partner");
  revalidatePath(`/partner/groups/${groupId}`);
  return ok({ status: "submitted" });
}

export async function markPartnerNotificationsRead(): Promise<ActionResult<{ ok: true }>> {
  const partner = await requirePartner();
  await markNotificationsRead({ audience: "partner", partner_code: partner.code });
  revalidatePath("/partner");
  return ok({ ok: true });
}

void ruleCheck;
