"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { groupServicesSchema, serviceSchema, type GroupServiceInput, type ServiceInput } from "@/lib/validation/services";
import { errorMessage, fail, ok, type ActionResult } from "@/lib/result";

export type ServiceRow = {
  id: string;
  name: string;
  kind: string;
  description: string | null;
  default_rate: number | null;
  currency: string | null;
  active: boolean;
  sort: number;
};

export type GroupServiceRow = {
  id: string;
  group_id: string;
  service_id: string | null;
  service_name: string;
  kind: string;
  from_place: string | null;
  to_place: string | null;
  service_date: string | null;
  pax: number | null;
  transfer_mode: string | null;
  notes: string | null;
  quantity: number;
  rate: number | null;
  currency: string | null;
  position: number;
};

const SERVICE_COLS = "id, name, kind, description, default_rate, currency, active, sort";
const GROUP_SERVICE_COLS = "id, group_id, service_id, service_name, kind, from_place, to_place, service_date, pax, transfer_mode, notes, quantity, rate, currency, position";

function revalidateAll() {
  revalidatePath("/settings/services");
  revalidatePath("/travel");
  revalidatePath("/travel/b2b");
  revalidatePath("/travel/groups");
  revalidatePath("/");
}

/** The Product / Service master. `activeOnly` for pickers; everything for the settings page. */
export async function listServices(activeOnly = true): Promise<ServiceRow[]> {
  await requireProfile();
  const supabase = await createClient();
  let q = supabase.from("services").select(SERVICE_COLS).order("sort").order("name");
  if (activeOnly) q = q.eq("active", true);
  const { data } = await q;
  return (data ?? []).map((r) => ({ ...r, default_rate: r.default_rate === null ? null : Number(r.default_rate) }));
}

export async function saveService(id: string | null, input: ServiceInput): Promise<ActionResult<{ id: string }>> {
  await requireProfile();
  const parsed = serviceSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields", z.flattenError(parsed.error).fieldErrors);
  const supabase = await createClient();
  const req = id ? supabase.from("services").update(parsed.data).eq("id", id).select("id").single() : supabase.from("services").insert(parsed.data).select("id").single();
  const { data, error } = await req;
  if (error || !data) {
    if (error?.code === "23505") return fail(`A service named "${parsed.data.name}" already exists`);
    return fail(errorMessage(error, "Could not save the service"));
  }
  revalidateAll();
  return ok({ id: data.id });
}

/** Remove a master entry. One already used on a group is deactivated instead, so the groups keep their snapshot. */
export async function deleteService(id: string): Promise<ActionResult<{ id: string; deactivated: boolean }>> {
  await requireProfile();
  const supabase = await createClient();
  const { count } = await supabase.from("group_services").select("id", { count: "exact", head: true }).eq("service_id", id);
  if ((count ?? 0) > 0) {
    const { error } = await supabase.from("services").update({ active: false }).eq("id", id);
    if (error) return fail(errorMessage(error, "Could not deactivate the service"));
    revalidateAll();
    return ok({ id, deactivated: true });
  }
  const { error } = await supabase.from("services").delete().eq("id", id);
  if (error) return fail(errorMessage(error, "Could not delete the service"));
  revalidateAll();
  return ok({ id, deactivated: false });
}

/** Services attached to a group, in display order. */
export async function listGroupServices(groupId: string): Promise<GroupServiceRow[]> {
  await requireProfile();
  if (!z.string().uuid().safeParse(groupId).success) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("group_services").select(GROUP_SERVICE_COLS).eq("group_id", groupId).order("position").order("created_at");
  return (data ?? []).map((r) => ({ ...r, quantity: Number(r.quantity), rate: r.rate === null ? null : Number(r.rate) }));
}

/**
 * Replace a group's services with the rows given: rows with an id are
 * updated, rows without one inserted, and rows no longer present removed.
 */
export async function saveGroupServices(groupId: string, rows: GroupServiceInput[]): Promise<ActionResult<{ saved: number; removed: number }>> {
  const profile = await requireProfile();
  if (!z.string().uuid().safeParse(groupId).success) return fail("Invalid group");
  const parsed = groupServicesSchema.safeParse(rows);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const idx = typeof first?.path[0] === "number" ? first.path[0] + 1 : null;
    return fail(`${idx ? `Service ${idx}: ` : ""}${first?.message ?? "Please check the service details"}`);
  }
  const supabase = await createClient();
  const { data: existing } = await supabase.from("group_services").select("id").eq("group_id", groupId);
  const keep = new Set(parsed.data.map((r) => r.id).filter((x): x is string => !!x));
  const stale = (existing ?? []).map((r) => r.id).filter((id) => !keep.has(id));
  if (stale.length) {
    const { error } = await supabase.from("group_services").delete().in("id", stale);
    if (error) return fail(errorMessage(error, "Could not remove a service"));
  }
  for (const [i, r] of parsed.data.entries()) {
    const { id, ...fields } = r;
    const patch = { ...fields, group_id: groupId, position: i };
    const { error } = id
      ? await supabase.from("group_services").update(patch).eq("id", id).eq("group_id", groupId)
      : await supabase.from("group_services").insert({ ...patch, created_by: profile.id });
    if (error) return fail(errorMessage(error, `Could not save service ${i + 1}`));
  }
  revalidateAll();
  return ok({ saved: parsed.data.length, removed: stale.length });
}
