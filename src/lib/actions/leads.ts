"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { addDays, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import {
  activitySchema,
  leadSchema,
  leadStatusChangeSchema,
  type ActivityInput,
  type LeadInput,
  type LeadStatusChangeInput,
} from "@/lib/validation/lead";
import { errorMessage, fail, ok, type ActionResult } from "@/lib/result";
import { todayISO, toISODate } from "@/lib/format";
import { LEAD_STATUSES, LOST_REASONS, labelFor } from "@/lib/constants";

function revalidateLeads(id?: string) {
  revalidatePath("/leads");
  revalidatePath("/leads/followups");
  revalidatePath("/");
  if (id) revalidatePath(`/leads/${id}`);
}

export async function createLead(input: LeadInput): Promise<ActionResult<{ id: string; lead_ref: string }>> {
  await requireProfile();
  const parsed = leadSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields", z.flattenError(parsed.error).fieldErrors);

  const supabase = await createClient();
  const year = new Date().getUTCFullYear();
  const { data: id, error } = await supabase.rpc("create_lead", { p_year: year, p_lead: parsed.data });
  if (error || !id) return fail(errorMessage(error, "Could not create lead"));

  const { data: row } = await supabase.from("leads").select("lead_ref").eq("id", id).single();
  revalidateLeads(id);
  return ok({ id, lead_ref: row?.lead_ref ?? "" });
}

export async function updateLead(id: string, input: LeadInput): Promise<ActionResult<{ id: string }>> {
  const profile = await requireProfile();
  const parsed = leadSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields", z.flattenError(parsed.error).fieldErrors);

  const supabase = await createClient();
  const { data: before } = await supabase.from("leads").select("status").eq("id", id).single();
  const { error } = await supabase.from("leads").update(parsed.data).eq("id", id);
  if (error) return fail(errorMessage(error, "Could not update lead"));

  if (before && before.status !== parsed.data.status) {
    await supabase.from("lead_activities").insert({
      lead_id: id,
      activity_type: "status_change",
      old_status: before.status,
      new_status: parsed.data.status,
      body: `Status changed to ${labelFor(LEAD_STATUSES, parsed.data.status)}`,
      created_by: profile.id,
    });
  }
  revalidateLeads(id);
  return ok({ id });
}

/** Status change with activity log entry (kanban drag, Mark Won, Mark Lost). */
export async function changeLeadStatus(
  id: string,
  input: LeadStatusChangeInput,
): Promise<ActionResult<{ status: string }>> {
  const profile = await requireProfile();
  const parsed = leadStatusChangeSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields", z.flattenError(parsed.error).fieldErrors);

  const supabase = await createClient();
  const { data: before, error: readError } = await supabase.from("leads").select("status").eq("id", id).single();
  if (readError || !before) return fail("Lead not found");
  if (before.status === parsed.data.status) return ok({ status: before.status });

  const { error } = await supabase
    .from("leads")
    .update({
      status: parsed.data.status,
      lost_reason: parsed.data.status === "lost" ? parsed.data.lost_reason : null,
    })
    .eq("id", id);
  if (error) return fail(errorMessage(error, "Could not change status"));

  const reason = parsed.data.lost_reason ? ` (${labelFor(LOST_REASONS, parsed.data.lost_reason)})` : "";
  const { error: actError } = await supabase.from("lead_activities").insert({
    lead_id: id,
    activity_type: "status_change",
    old_status: before.status,
    new_status: parsed.data.status,
    body: parsed.data.note ?? `Moved to ${labelFor(LEAD_STATUSES, parsed.data.status)}${reason}`,
    created_by: profile.id,
  });
  if (actError) console.error("activity log failed", actError);

  revalidateLeads(id);
  return ok({ status: parsed.data.status });
}

export async function addLeadActivity(id: string, input: ActivityInput): Promise<ActionResult<{ id: string }>> {
  const profile = await requireProfile();
  const parsed = activitySchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields", z.flattenError(parsed.error).fieldErrors);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lead_activities")
    .insert({ lead_id: id, ...parsed.data, created_by: profile.id })
    .select("id")
    .single();
  if (error || !data) return fail(errorMessage(error, "Could not add activity"));
  revalidateLeads(id);
  return ok({ id: data.id });
}

/** Snooze the follow-up by N days from today (Asia/Dubai). */
export async function snoozeFollowup(id: string, days: number): Promise<ActionResult<{ next_followup_date: string }>> {
  await requireProfile();
  if (![1, 3, 7].includes(days)) return fail("Invalid snooze");
  const supabase = await createClient();
  const next = toISODate(addDays(parseISO(todayISO()), days));
  const { error } = await supabase.from("leads").update({ next_followup_date: next }).eq("id", id);
  if (error) return fail(errorMessage(error, "Could not snooze"));
  revalidateLeads(id);
  return ok({ next_followup_date: next });
}

export async function setFollowupDate(id: string, date: string | null): Promise<ActionResult<{ next_followup_date: string | null }>> {
  await requireProfile();
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail("Invalid date");
  const supabase = await createClient();
  const { error } = await supabase.from("leads").update({ next_followup_date: date }).eq("id", id);
  if (error) return fail(errorMessage(error, "Could not update follow-up"));
  revalidateLeads(id);
  return ok({ next_followup_date: date });
}

// ---------------------------------------------------------------------------
// bulk import
// ---------------------------------------------------------------------------
export type BulkLeadResult = {
  created: number;
  skipped: number;
  failed: { row: number; error: string }[];
};

/**
 * Create many leads from a CSV. Each row is validated with the normal lead
 * schema and numbered atomically through create_lead(); rows that fail are
 * reported with their row number and the rest still go in.
 */
export async function bulkCreateLeads(rows: LeadInput[], options?: { skipExistingPhones?: boolean }): Promise<ActionResult<BulkLeadResult>> {
  await requireProfile();
  if (!Array.isArray(rows) || rows.length === 0) return fail("Nothing to import");
  if (rows.length > 500) return fail("Import at most 500 rows at a time");

  const supabase = await createClient();
  const result: BulkLeadResult = { created: 0, skipped: 0, failed: [] };

  let existing = new Set<string>();
  if (options?.skipExistingPhones) {
    const phones = rows.map((r) => String(r.phone ?? "").trim()).filter(Boolean);
    if (phones.length) {
      const { data } = await supabase.from("leads").select("phone").in("phone", phones);
      existing = new Set((data ?? []).map((l) => l.phone));
    }
  }

  const year = new Date().getUTCFullYear();
  const seen = new Set<string>();
  for (let i = 0; i < rows.length; i++) {
    const parsed = leadSchema.safeParse(rows[i]);
    if (!parsed.success) {
      const fields = z.flattenError(parsed.error).fieldErrors as Record<string, string[] | undefined>;
      const msg = Object.entries(fields)
        .map(([k, v]) => `${k}: ${v?.[0] ?? "invalid"}`)
        .join("; ");
      result.failed.push({ row: i + 1, error: msg || "Invalid row" });
      continue;
    }
    const phone = parsed.data.phone;
    if (options?.skipExistingPhones && (existing.has(phone) || seen.has(phone))) {
      result.skipped++;
      continue;
    }
    seen.add(phone);
    const { error } = await supabase.rpc("create_lead", { p_year: year, p_lead: parsed.data });
    if (error) result.failed.push({ row: i + 1, error: errorMessage(error, "Could not create lead") });
    else result.created++;
  }

  revalidatePath("/leads");
  revalidatePath("/leads/followups");
  revalidatePath("/");
  return ok(result);
}
