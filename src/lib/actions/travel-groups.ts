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

export type GroupOption = {
  id: string;
  travel_date: string;
  group_code: string;
  label: string | null;
  guide_name: string | null;
  traveller_count: number;
};

/** "15 Oct 2026 · G03 · Canton Phase 2 (7 travellers)" */
export async function formatGroupOption(g: GroupOption): Promise<string> {
  return groupLabel(g);
}

function groupLabel(g: GroupOption) {
  const parts = [formatDate(g.travel_date), g.group_code];
  if (g.label) parts.push(g.label);
  return `${parts.join(" · ")} (${g.traveller_count} traveller${g.traveller_count === 1 ? "" : "s"})`;
}

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
      group_code: code,
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
    .select("id, travel_date, group_code, label, guide_name, travellers(count)")
    .order("travel_date", { ascending: false })
    .order("group_code", { ascending: true })
    .limit(limit);
  if (q) {
    const like = `%${q.replace(/[%,]/g, "")}%`;
    const iso = q.match(/^\d{4}-\d{2}(-\d{2})?$/);
    req = iso ? req.like("travel_date::text", `${q}%`) : req.or(`group_code.ilike.${like},label.ilike.${like},guide_name.ilike.${like}`);
  }
  const { data } = await req;
  return (data ?? []).map((g) => ({
    id: g.id,
    travel_date: g.travel_date,
    group_code: g.group_code,
    label: g.label,
    guide_name: g.guide_name,
    traveller_count: Array.isArray(g.travellers) ? Number(g.travellers[0]?.count ?? 0) : 0,
  }));
}
