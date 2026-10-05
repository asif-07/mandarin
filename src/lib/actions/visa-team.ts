"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVisaMember, type VisaMember } from "@/lib/portal/auth";
import { recordEvent, transition, type Actor } from "@/lib/workflow/engine";
import { listGuides, upsertGuide, type GuideInput, type GuideRow } from "@/lib/workflow/guides";
import { markNotificationsRead } from "@/lib/workflow/data";
import { WORKFLOW_ORDER } from "@/lib/constants";
import { fail, ok, type ActionResult } from "@/lib/result";

async function requireMember(): Promise<VisaMember> {
  const m = await getVisaMember();
  if (!m) throw new Error("Visa Team sign-in required");
  return m;
}
const actorOf = (m: VisaMember): Actor => ({ kind: m.role === "ground_guide" ? "guide" : "visa_team", name: `${m.name} (${m.code})` });
const stage = (s: string | null) => (s ? WORKFLOW_ORDER.indexOf(s as never) : -1);

function revalidateVisa(groupId: string) {
  revalidatePath("/visa-team");
  revalidatePath(`/visa-team/groups/${groupId}`);
  revalidatePath("/travel");
  revalidatePath("/travel/b2b");
  revalidatePath("/travel/workflow");
  revalidatePath("/");
}

/** The Visa Team starts actual processing of a CTS-approved group. */
export async function startVisaProcessing(groupId: string): Promise<ActionResult<{ status: string }>> {
  const m = await requireMember();
  const supabase = createAdminClient();
  const { data: g } = await supabase.from("travel_groups").select("workflow_status").eq("id", groupId).maybeSingle();
  if (!g) return fail("Group not found");
  if (g.workflow_status !== "company_approved") return fail("Only a CTS-approved group can start processing");
  const res = await transition(groupId, "visa_processing", actorOf(m), { patch: { visa_processing_started_at: new Date().toISOString() } });
  if (!res.ok) return fail(res.error);
  revalidateVisa(groupId);
  return ok({ status: "visa_processing" });
}

/** Assign (or reassign) a guide from the master; copies name and phone onto the group and moves it to Guide assigned once the visa is approved. */
export async function assignGuide(groupId: string, guideId: string | null, notes: string | null): Promise<ActionResult<{ status: string | null }>> {
  const m = await requireMember();
  const supabase = createAdminClient();
  const { data: g } = await supabase.from("travel_groups").select("workflow_status, guide_id").eq("id", groupId).maybeSingle();
  if (!g) return fail("Group not found");
  let guide: GuideRow | null = null;
  if (guideId) {
    const all = await listGuides(false);
    guide = all.find((x) => x.id === guideId) ?? null;
    if (!guide) return fail("Guide not found");
  }
  const patch = { guide_id: guide?.id ?? null, guide_name: guide?.name ?? null, guide_phone: guide?.phone ?? null, guide_notes: notes?.trim() || null };
  const note = guide ? `Guide ${guide.name}${guide.phone ? ` · ${guide.phone}` : ""}${guide.role ? ` · ${guide.role}` : ""}${notes?.trim() ? ` · ${notes.trim()}` : ""}` : "Guide unassigned";
  // Status moves to guide_assigned only from visa_approved (or a re-assignment while still at that step); later stages keep their status.
  if (guide && (g.workflow_status === "visa_approved" || g.workflow_status === "guide_assigned")) {
    const res = await transition(groupId, "guide_assigned", actorOf(m), { note, patch });
    if (!res.ok) return fail(res.error);
  } else {
    const { error } = await supabase.from("travel_groups").update(patch).eq("id", groupId);
    if (error) return fail(error.message);
    await recordEvent(supabase, groupId, actorOf(m), guide ? (g.guide_id ? "Guide reassigned" : "Guide assigned") : "Guide unassigned", { note });
  }
  revalidateVisa(groupId);
  return ok({ status: g.workflow_status });
}

/** Destination and transfer / vehicle details under Ground operations. */
export async function setGroundOps(groupId: string, input: { destination: string; vehicle_notes: string }): Promise<ActionResult<{ id: string }>> {
  const m = await requireMember();
  const supabase = createAdminClient();
  const { error } = await supabase.from("travel_groups").update({ destination: input.destination.trim() || null, vehicle_notes: input.vehicle_notes.trim() || null }).eq("id", groupId);
  if (error) return fail(error.message);
  await recordEvent(supabase, groupId, actorOf(m), "Ground operations updated", { note: [input.destination.trim(), input.vehicle_notes.trim()].filter(Boolean).join(" · ") || null });
  revalidateVisa(groupId);
  return ok({ id: groupId });
}

export async function markTravellingToChina(groupId: string): Promise<ActionResult<{ status: string }>> {
  const m = await requireMember();
  const supabase = createAdminClient();
  const { data: g } = await supabase.from("travel_groups").select("workflow_status").eq("id", groupId).maybeSingle();
  if (!g) return fail("Group not found");
  if (stage(g.workflow_status) < stage("visa_approved") || stage(g.workflow_status) >= stage("travelling_to_china")) return fail("The group must have an approved visa and not yet be travelling");
  const res = await transition(groupId, "travelling_to_china", actorOf(m));
  if (!res.ok) return fail(res.error);
  revalidateVisa(groupId);
  return ok({ status: "travelling_to_china" });
}

/** CONFIRM CHINA ENTRY: only after the stamped visa copy is uploaded; records date, time and who confirmed. */
export async function confirmChinaEntry(groupId: string): Promise<ActionResult<{ status: string }>> {
  const m = await requireMember();
  const supabase = createAdminClient();
  const { data: g } = await supabase.from("travel_groups").select("workflow_status, stamped_visa_path").eq("id", groupId).maybeSingle();
  if (!g) return fail("Group not found");
  if (!g.stamped_visa_path) return fail("Upload the stamped visa copy first");
  if (stage(g.workflow_status) >= stage("travelling_in_china")) return fail("Entry was already confirmed");
  const res = await transition(groupId, "travelling_in_china", actorOf(m), { patch: { china_entry_at: new Date().toISOString(), china_entry_confirmed_by: `${m.name} (${m.code})` } });
  if (!res.ok) return fail(res.error);
  revalidateVisa(groupId);
  return ok({ status: "travelling_in_china" });
}

/** MARK GROUP AS EXITED: records exit date, time and who confirmed. */
export async function markGroupExited(groupId: string): Promise<ActionResult<{ status: string }>> {
  const m = await requireMember();
  const supabase = createAdminClient();
  const { data: g } = await supabase.from("travel_groups").select("workflow_status").eq("id", groupId).maybeSingle();
  if (!g) return fail("Group not found");
  if (g.workflow_status !== "travelling_in_china") return fail("Confirm China entry before marking the group as exited");
  const res = await transition(groupId, "china_exited", actorOf(m), { patch: { china_exit_at: new Date().toISOString(), china_exit_confirmed_by: `${m.name} (${m.code})` } });
  if (!res.ok) return fail(res.error);
  revalidateVisa(groupId);
  return ok({ status: "china_exited" });
}

export async function markVisaTeamNotificationsRead(): Promise<ActionResult<{ ok: true }>> {
  await requireMember();
  await markNotificationsRead({ audience: "visa_team" });
  revalidatePath("/visa-team");
  return ok({ ok: true });
}

export async function saveGuideForVisaTeam(id: string | null, input: GuideInput): Promise<ActionResult<{ id: string }>> {
  await requireMember();
  const res = await upsertGuide(id, input);
  if (!res.ok) return fail(res.error);
  revalidatePath("/visa-team/guides");
  return ok({ id: res.id });
}
