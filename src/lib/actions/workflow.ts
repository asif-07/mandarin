"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailVisaToPartner, loadGroupCore, recordEvent, transition, type Actor } from "@/lib/workflow/engine";
import { listGuides, upsertGuide, type GuideInput, type GuideRow } from "@/lib/workflow/guides";
import { markNotificationsRead } from "@/lib/workflow/data";
import { generateAccessKey, hashAccessKey } from "@/lib/scanner/auth";
import { VISA_TEAM_ROLES } from "@/lib/constants";
import { errorMessage, fail, ok, type ActionResult } from "@/lib/result";

function revalidateWorkflow() {
  revalidatePath("/");
  revalidatePath("/travel");
  revalidatePath("/travel/b2b");
  revalidatePath("/travel/workflow");
}

async function companyActor(): Promise<Actor> {
  const profile = await requireProfile();
  return { kind: "company", name: profile.display_name };
}

/** Approve, request a correction on, or reject a partner submission. */
export async function companyDecision(groupId: string, decision: "approve" | "correction" | "reject", note?: string | null): Promise<ActionResult<{ status: string }>> {
  const profile = await requireProfile();
  const actor: Actor = { kind: "company", name: profile.display_name };
  const trimmed = note?.trim() || null;
  if (decision !== "approve" && !trimmed) return fail(decision === "correction" ? "Tell the partner what to correct" : "Give the reason for rejecting");
  const admin = createAdminClient();
  const g = await loadGroupCore(admin, groupId);
  if (!g) return fail("Group not found");
  if (!["submitted", "correction_requested"].includes(g.workflow_status ?? "") && decision !== "approve") return fail("Only a submitted group can be decided on");
  const to = decision === "approve" ? "company_approved" : decision === "correction" ? "correction_requested" : "rejected";
  const res = await transition(groupId, to, actor, {
    note: trimmed,
    patch: { company_decision_note: trimmed, ...(decision === "approve" ? { company_approved_at: new Date().toISOString(), company_approved_by: profile.id } : {}) },
  });
  if (!res.ok) return fail(res.error);
  revalidateWorkflow();
  return ok({ status: to });
}

/** Put a group created by hand into the Visa Team's queue (counts as company approved). */
export async function sendToVisaTeam(groupId: string): Promise<ActionResult<{ status: string }>> {
  const profile = await requireProfile();
  const res = await transition(groupId, "company_approved", { kind: "company", name: profile.display_name }, { patch: { company_approved_at: new Date().toISOString(), company_approved_by: profile.id } });
  if (!res.ok) return fail(res.error);
  revalidateWorkflow();
  return ok({ status: "company_approved" });
}

/** CTS reviews the visa the Visa Team uploaded: approved → partner notified and emailed, visa downloadable in the portal. */
export async function approveVisa(groupId: string): Promise<ActionResult<{ email: string }>> {
  const profile = await requireProfile();
  const admin = createAdminClient();
  const g = await loadGroupCore(admin, groupId);
  if (!g) return fail("Group not found");
  if (!g.visa_path) return fail("No visa has been uploaded for this group yet");
  const res = await transition(groupId, "visa_approved", { kind: "company", name: profile.display_name }, { patch: { visa_approved_at: new Date().toISOString(), visa_approved_by: profile.id } });
  if (!res.ok) return fail(res.error);
  const mail = await emailVisaToPartner(admin, res.group);
  revalidateWorkflow();
  return ok({ email: mail.status });
}

/** Re-send the approved visa to the partner's registered email. */
export async function resendVisaEmail(groupId: string): Promise<ActionResult<{ email: string; error?: string }>> {
  await requireProfile();
  const admin = createAdminClient();
  const g = await loadGroupCore(admin, groupId);
  if (!g) return fail("Group not found");
  if (!g.visa_path) return fail("No visa on this group");
  const mail = await emailVisaToPartner(admin, g);
  revalidateWorkflow();
  return ok({ email: mail.status, error: mail.error });
}

export async function markGroupCompleted(groupId: string): Promise<ActionResult<{ status: string }>> {
  const actor = await companyActor();
  const res = await transition(groupId, "completed", actor, { patch: { completed_at: new Date().toISOString() } });
  if (!res.ok) return fail(res.error);
  revalidateWorkflow();
  return ok({ status: "completed" });
}

/** Let the partner download the stamped entry visa copy from their portal. */
export async function setStampedVisaShared(groupId: string, shared: boolean): Promise<ActionResult<{ shared: boolean }>> {
  const actor = await companyActor();
  const admin = createAdminClient();
  const { error } = await admin.from("travel_groups").update({ stamped_visa_shared: shared }).eq("id", groupId);
  if (error) return fail(errorMessage(error, "Could not update sharing"));
  await recordEvent(admin, groupId, actor, shared ? "Stamped visa copy shared with the partner" : "Stamped visa copy hidden from the partner");
  revalidateWorkflow();
  return ok({ shared });
}

export async function markCompanyNotificationsRead(): Promise<ActionResult<{ ok: true }>> {
  await requireProfile();
  await markNotificationsRead({ audience: "company" });
  revalidatePath("/");
  return ok({ ok: true });
}

// ---------------------------------------------------------------------------
// Partner portal access
// ---------------------------------------------------------------------------
export type PartnerAccessRow = { id: string; code: string; name: string | null; email: string | null; portal_active: boolean; has_key: boolean; portal_last_seen_at: string | null };

export async function listPartnerAccess(): Promise<PartnerAccessRow[]> {
  await requireProfile();
  const supabase = await createClient();
  const { data } = await supabase.from("b2b_partners").select("id, code, name, email, portal_active, portal_key_hash, portal_last_seen_at").order("code");
  return (data ?? []).map((p) => ({ id: p.id, code: p.code, name: p.name, email: p.email, portal_active: p.portal_active, has_key: !!p.portal_key_hash, portal_last_seen_at: p.portal_last_seen_at }));
}

/** Issue (or re-issue) the partner's portal access key; shown once. Also activates the portal for them. */
export async function issuePartnerPortalKey(partnerId: string): Promise<ActionResult<{ access_key: string }>> {
  await requireProfile();
  const key = generateAccessKey();
  const supabase = await createClient();
  const { error } = await supabase.from("b2b_partners").update({ portal_key_hash: hashAccessKey(key), portal_active: true }).eq("id", partnerId);
  if (error) return fail(errorMessage(error, "Could not issue the key"));
  revalidatePath("/settings/partner-portal");
  return ok({ access_key: key });
}

export async function setPartnerPortalActive(partnerId: string, active: boolean): Promise<ActionResult<{ active: boolean }>> {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.from("b2b_partners").update({ portal_active: active }).eq("id", partnerId);
  if (error) return fail(errorMessage(error, "Could not update the partner"));
  revalidatePath("/settings/partner-portal");
  return ok({ active });
}

// ---------------------------------------------------------------------------
// China Visa Team members
// ---------------------------------------------------------------------------
export type VisaMemberRow = { id: string; code: string; name: string; role: string; phone: string | null; guide_id: string | null; active: boolean; last_seen_at: string | null };

export async function listVisaMembers(): Promise<VisaMemberRow[]> {
  await requireProfile();
  const supabase = await createClient();
  const { data } = await supabase.from("visa_team_members").select("id, code, name, role, phone, guide_id, active, last_seen_at").order("code");
  return data ?? [];
}

const memberSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,12}$/, "Code: 2 to 12 letters or digits"),
  name: z.string().trim().min(1, "Name is required").max(120),
  role: z.enum(VISA_TEAM_ROLES.map((r) => r.value) as [string, ...string[]]).default("visa_processor"),
  phone: z.string().trim().max(40).optional().nullable().transform((v) => v || null),
  guide_id: z.string().optional().nullable().transform((v) => v || null),
});

export async function createVisaMember(input: z.input<typeof memberSchema>): Promise<ActionResult<{ id: string; access_key: string }>> {
  const profile = await requireProfile();
  const parsed = memberSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check the details");
  const key = generateAccessKey();
  const supabase = await createClient();
  const { data, error } = await supabase.from("visa_team_members").insert({ ...parsed.data, access_key_hash: hashAccessKey(key), created_by: profile.id }).select("id").single();
  if (error || !data) {
    if (error?.code === "23505") return fail(`Code ${parsed.data.code} already exists`);
    return fail(errorMessage(error, "Could not create the member"));
  }
  revalidatePath("/settings/visa-team");
  return ok({ id: data.id, access_key: key });
}

export async function rotateVisaMemberKey(id: string): Promise<ActionResult<{ access_key: string }>> {
  await requireProfile();
  const key = generateAccessKey();
  const supabase = await createClient();
  const { error } = await supabase.from("visa_team_members").update({ access_key_hash: hashAccessKey(key) }).eq("id", id);
  if (error) return fail(errorMessage(error, "Could not rotate the key"));
  return ok({ access_key: key });
}

export async function setVisaMemberActive(id: string, active: boolean): Promise<ActionResult<{ id: string }>> {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.from("visa_team_members").update({ active }).eq("id", id);
  if (error) return fail(errorMessage(error, "Could not update the member"));
  revalidatePath("/settings/visa-team");
  return ok({ id });
}

// ---------------------------------------------------------------------------
// Guide / staff master (company side)
// ---------------------------------------------------------------------------
export async function listGuidesForCompany(): Promise<GuideRow[]> {
  await requireProfile();
  return listGuides(false);
}

export async function saveGuideForCompany(id: string | null, input: GuideInput): Promise<ActionResult<{ id: string }>> {
  await requireProfile();
  const res = await upsertGuide(id, input);
  if (!res.ok) return fail(res.error);
  revalidatePath("/settings/guides");
  revalidateWorkflow();
  return ok({ id: res.id });
}

// ---------------------------------------------------------------------------
// Manual China entry / exit (Travel → Entry / Exit), for any group
// ---------------------------------------------------------------------------
const ENTERED_OR_LATER = ["travelling_in_china", "china_exited", "completed"];

/** Mark the group as entered China now (or at the given time). Travellers stay as they are; the group timeline records who confirmed. */
export async function markGroupEntered(groupId: string, at?: string | null): Promise<ActionResult<{ status: string }>> {
  const profile = await requireProfile();
  const admin = createAdminClient();
  const g = await loadGroupCore(admin, groupId);
  if (!g) return fail("Group not found");
  if (ENTERED_OR_LATER.includes(g.workflow_status ?? "")) return fail("Entry is already confirmed for this group");
  const when = at && !Number.isNaN(Date.parse(at)) ? new Date(at).toISOString() : new Date().toISOString();
  const res = await transition(groupId, "travelling_in_china", { kind: "company", name: profile.display_name }, { note: "Entry confirmed manually by CTS", patch: { china_entry_at: when, china_entry_confirmed_by: `${profile.display_name} (CTS)` } });
  if (!res.ok) return fail(res.error);
  revalidateWorkflow();
  revalidatePath("/travel/movements");
  return ok({ status: "travelling_in_china" });
}

/** Mark the group as exited China now (or at the given time); its travellers become Travelled. */
export async function markGroupExitedManually(groupId: string, at?: string | null): Promise<ActionResult<{ status: string }>> {
  const profile = await requireProfile();
  const admin = createAdminClient();
  const g = await loadGroupCore(admin, groupId);
  if (!g) return fail("Group not found");
  if (["china_exited", "completed"].includes(g.workflow_status ?? "")) return fail("Exit is already confirmed for this group");
  const when = at && !Number.isNaN(Date.parse(at)) ? new Date(at).toISOString() : new Date().toISOString();
  const patch: Record<string, string | null> = { china_exit_at: when, china_exit_confirmed_by: `${profile.display_name} (CTS)` };
  // An exit implies the entry: fill it from the travel date when nobody recorded it.
  const { data: cur } = await admin.from("travel_groups").select("china_entry_at, travel_date").eq("id", groupId).maybeSingle();
  if (cur && !cur.china_entry_at) {
    patch.china_entry_at = new Date(`${cur.travel_date}T00:00:00Z`).toISOString();
    patch.china_entry_confirmed_by = `${profile.display_name} (CTS, with the exit)`;
  }
  const res = await transition(groupId, "china_exited", { kind: "company", name: profile.display_name }, { note: "Exit confirmed manually by CTS", patch });
  if (!res.ok) return fail(res.error);
  await admin.from("travellers").update({ status: "travelled" }).eq("travel_group_id", groupId).not("status", "in", "(cancelled,travelled)");
  revalidateWorkflow();
  revalidatePath("/travel/movements");
  revalidatePath("/travel/travellers");
  return ok({ status: "china_exited" });
}

/** Undo a manual entry or exit confirmation (wrong group clicked). */
export async function undoGroupMovement(groupId: string, kind: "entry" | "exit"): Promise<ActionResult<{ status: string | null }>> {
  const profile = await requireProfile();
  const admin = createAdminClient();
  const { data: g } = await admin.from("travel_groups").select("workflow_status, guide_id, visa_approved_at, submitted_by_partner").eq("id", groupId).maybeSingle();
  if (!g) return fail("Group not found");
  if (kind === "exit") {
    if (g.workflow_status !== "china_exited") return fail("This group is not marked as exited");
    const { error } = await admin.from("travel_groups").update({ workflow_status: "travelling_in_china", workflow_updated_at: new Date().toISOString(), china_exit_at: null, china_exit_confirmed_by: null, completed_at: null }).eq("id", groupId);
    if (error) return fail(errorMessage(error, "Could not undo"));
    await admin.from("travellers").update({ status: "visa_approved" }).eq("travel_group_id", groupId).eq("status", "travelled");
    await recordEvent(admin, groupId, { kind: "company", name: profile.display_name }, "Exit confirmation undone", { status: "travelling_in_china" });
  } else {
    if (g.workflow_status !== "travelling_in_china") return fail("Undo the exit first, or the group is not marked as entered");
    // Back to the step before entry: guide assigned when one is set, else visa approved, else out of the workflow for manual groups.
    const back = g.guide_id ? "guide_assigned" : g.visa_approved_at ? "visa_approved" : g.submitted_by_partner ? "visa_approved" : null;
    const { error } = await admin.from("travel_groups").update({ workflow_status: back, workflow_updated_at: new Date().toISOString(), china_entry_at: null, china_entry_confirmed_by: null }).eq("id", groupId);
    if (error) return fail(errorMessage(error, "Could not undo"));
    await recordEvent(admin, groupId, { kind: "company", name: profile.display_name }, "Entry confirmation undone", { status: back });
  }
  revalidateWorkflow();
  revalidatePath("/travel/movements");
  return ok({ status: kind === "exit" ? "travelling_in_china" : null });
}
