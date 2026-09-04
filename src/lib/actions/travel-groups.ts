"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { bulkGroupSchema, groupSchema, type BulkGroupInput, type GroupInput } from "@/lib/validation/travel";
import { errorMessage, fail, ok, type ActionResult } from "@/lib/result";
import { formatDate } from "@/lib/format";

function revalidateTravel() {
  revalidatePath("/travel");
  revalidatePath("/travel/groups");
  revalidatePath("/travel/calendar");
  revalidatePath("/travel/travellers");
  revalidatePath("/");
}

/** "2026-10" -> whole month, "2026-10-15" -> that day; anything else -> null. */
export async function dateRangeForQuery(q: string): Promise<[string, string] | null> {
  return dateRange(q);
}

function dateRange(q: string): [string, string] | null {
  const day = q.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (day) return [q, q];
  const month = q.match(/^(\d{4})-(\d{2})$/);
  if (month) {
    const last = new Date(Date.UTC(Number(month[1]), Number(month[2]), 0)).getUTCDate();
    return [`${q}-01`, `${q}-${String(last).padStart(2, "0")}`];
  }
  return null;
}

export type GroupOption = {
  id: string;
  travel_date: string;
  travel_end_date: string;
  group_code: string;
  label: string | null;
  guide_name: string | null;
  reference_prefix: string;
  traveller_count: number;
};

export async function createGroup(input: GroupInput): Promise<ActionResult<{ id: string }>> {
  const profile = await requireProfile();
  const parsed = groupSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields", z.flattenError(parsed.error).fieldErrors);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("travel_groups")
    .insert({ ...parsed.data, created_by: profile.id })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return fail(`${parsed.data.group_code} already exists on ${formatDate(parsed.data.travel_date)}`);
    return fail(errorMessage(error, "Could not create group"));
  }
  revalidateTravel();
  return ok({ id: data.id });
}

/** Creates G01..Gn for a date, skipping codes that already exist. */
export async function bulkCreateGroups(input: BulkGroupInput): Promise<ActionResult<{ created: number; skipped: number }>> {
  const profile = await requireProfile();
  const parsed = bulkGroupSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields", z.flattenError(parsed.error).fieldErrors);
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("travel_groups")
    .select("group_code")
    .eq("travel_date", parsed.data.travel_date);
  const have = new Set((existing ?? []).map((g) => g.group_code));

  const rows = Array.from({ length: parsed.data.count }, (_, i) => `G${String(i + 1).padStart(2, "0")}`)
    .filter((code) => !have.has(code))
    .map((code) => ({
      travel_date: parsed.data.travel_date,
      travel_end_date: parsed.data.travel_end_date,
      group_code: code,
      reference_prefix: parsed.data.reference_prefix,
      label: parsed.data.label,
      guide_name: parsed.data.guide_name,
      created_by: profile.id,
    }));

  if (rows.length > 0) {
    const { error } = await supabase.from("travel_groups").insert(rows);
    if (error) return fail(errorMessage(error, "Could not create groups"));
  }
  revalidateTravel();
  return ok({ created: rows.length, skipped: parsed.data.count - rows.length });
}

export async function updateGroup(id: string, input: GroupInput): Promise<ActionResult<{ id: string }>> {
  await requireProfile();
  const parsed = groupSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields", z.flattenError(parsed.error).fieldErrors);
  const supabase = await createClient();
  const { error } = await supabase.from("travel_groups").update(parsed.data).eq("id", id);
  if (error) {
    if (error.code === "23505") return fail(`${parsed.data.group_code} already exists on ${formatDate(parsed.data.travel_date)}`);
    return fail(errorMessage(error, "Could not update group"));
  }
  revalidateTravel();
  return ok({ id });
}

export async function deleteGroup(id: string): Promise<ActionResult<{ id: string }>> {
  await requireProfile();
  const supabase = await createClient();
  const { count } = await supabase.from("travellers").select("id", { count: "exact", head: true }).eq("travel_group_id", id);
  if (count && count > 0) return fail(`This group has ${count} traveller${count === 1 ? "" : "s"}. Move them first.`);
  const { error } = await supabase.from("travel_groups").delete().eq("id", id);
  if (error) return fail(errorMessage(error, "Could not delete group"));
  revalidateTravel();
  return ok({ id });
}

/** Searchable group list for dropdowns, newest travel dates first. */
export async function searchGroups(query: string, limit = 60): Promise<GroupOption[]> {
  await requireProfile();
  const supabase = await createClient();
  const q = query.trim();
  let req = supabase
    .from("travel_groups")
    .select("id, travel_date, travel_end_date, group_code, label, guide_name, reference_prefix, travellers(count)")
    .order("travel_date", { ascending: false })
    .order("group_code", { ascending: true })
    .limit(limit);
  if (q) {
    const range = dateRange(q);
    if (range) req = req.gte("travel_date", range[0]).lte("travel_date", range[1]);
    else {
      const like = `%${q.replace(/[%,]/g, "")}%`;
      req = req.or(`group_code.ilike.${like},label.ilike.${like},guide_name.ilike.${like}`);
    }
  }
  const { data } = await req;
  return (data ?? []).map((g) => ({
    id: g.id,
    travel_date: g.travel_date,
    travel_end_date: g.travel_end_date,
    group_code: g.group_code,
    label: g.label,
    guide_name: g.guide_name,
    reference_prefix: g.reference_prefix,
    traveller_count: Array.isArray(g.travellers) ? Number(g.travellers[0]?.count ?? 0) : 0,
  }));
}
