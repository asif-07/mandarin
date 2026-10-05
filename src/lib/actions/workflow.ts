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
