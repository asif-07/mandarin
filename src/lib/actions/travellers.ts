"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { quickTravellerSchema, travellerSchema, type QuickTravellerInput, type TravellerInput } from "@/lib/validation/travel";
import { errorMessage, fail, ok, type ActionResult } from "@/lib/result";
import { REQUIRED_DOC_TYPES, TRAVELLER_STATUSES } from "@/lib/constants";

export async function revalidateTraveller(id?: string) {
  revalidatePath("/travel");
  revalidatePath("/travel/travellers");
  revalidatePath("/travel/calendar");
  revalidatePath("/");
  if (id) revalidatePath(`/travel/travellers/${id}`);
}

export async function createTraveller(input: TravellerInput): Promise<ActionResult<{ id: string; traveller_ref: string }>> {
  await requireProfile();
  const parsed = travellerSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields", z.flattenError(parsed.error).fieldErrors);
  const supabase = await createClient();
  const year = Number(parsed.data.travel_start_date.slice(0, 4));
  const { data: id, error } = await supabase.rpc("create_traveller", { p_year: year, p_traveller: parsed.data });
  if (error || !id) return fail(errorMessage(error, "Could not create traveller"));
  const { data: row } = await supabase.from("travellers").select("traveller_ref").eq("id", id).single();
  await revalidateTraveller(id);
  return ok({ id, traveller_ref: row?.traveller_ref ?? "" });
}

export async function updateTraveller(id: string, input: TravellerInput): Promise<ActionResult<{ id: string }>> {
  await requireProfile();
  const parsed = travellerSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields", z.flattenError(parsed.error).fieldErrors);
  const supabase = await createClient();
  const { error } = await supabase.from("travellers").update(parsed.data).eq("id", id);
  if (error) return fail(errorMessage(error, "Could not update traveller"));
  await revalidateTraveller(id);
  return ok({ id });
}

/** Take a traveller out of their group. The traveller record and documents are kept. */
export async function removeTravellerFromGroup(id: string): Promise<ActionResult<{ id: string }>> {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.from("travellers").update({ travel_group_id: null }).eq("id", id);
  if (error) return fail(errorMessage(error, "Could not remove from group"));
  await revalidateTraveller(id);
  return ok({ id });
}

export async function setTravellerStatus(id: string, status: string): Promise<ActionResult<{ status: string }>> {
  await requireProfile();
  if (!TRAVELLER_STATUSES.some((s) => s.value === status)) return fail("Invalid status");
  const supabase = await createClient();
  const { error } = await supabase.from("travellers").update({ status }).eq("id", id);
  if (error) return fail(errorMessage(error, "Could not update status"));
  await revalidateTraveller(id);
  return ok({ status });
}

/**
 * Auto-advance Documents Pending -> Documents Complete when every required
 * slot is filled, and fall back to Pending if a required document is removed
 * while the record is still at Documents Complete. Returns the new status if
 * it changed.
 */
export async function reconcileDocumentStatus(
  supabase: SupabaseClient<Database>,
  travellerId: string,
): Promise<string | null> {
  const [{ data: traveller }, { data: docs }] = await Promise.all([
    supabase.from("travellers").select("status, travel_group_id").eq("id", travellerId).single(),
    supabase.from("traveller_documents").select("doc_type").eq("traveller_id", travellerId).is("deleted_at", null),
  ]);
  if (!traveller) return null;
  const present = new Set((docs ?? []).map((d) => d.doc_type));
  if (traveller.travel_group_id) {
    const { data: groupDocs } = await supabase.from("group_documents").select("doc_type").eq("group_id", traveller.travel_group_id).is("deleted_at", null);
    (groupDocs ?? []).forEach((d) => present.add(d.doc_type));
  }
  const complete = REQUIRED_DOC_TYPES.every((t) => present.has(t));

  if (traveller.status === "documents_pending" && complete) {
    await supabase.from("travellers").update({ status: "documents_complete" }).eq("id", travellerId);
    return "documents_complete";
  }
  if (traveller.status === "documents_complete" && !complete) {
    await supabase.from("travellers").update({ status: "documents_pending" }).eq("id", travellerId);
    return "documents_pending";
  }
  return null;
}

/** Permanently delete a traveller. Document rows cascade; files stay in storage for the audit trail. */
export async function deleteTraveller(id: string): Promise<ActionResult<{ id: string; groupDate: string | null }>> {
  await requireProfile();
  const supabase = await createClient();
  const { data: t } = await supabase.from("travellers").select("id, travel_group_id, group:travel_groups(travel_date)").eq("id", id).maybeSingle();
  if (!t) return fail("Traveller not found");
  const { error } = await supabase.from("travellers").delete().eq("id", id);
  if (error) return fail(errorMessage(error, "Could not delete traveller"));
  await revalidateTraveller();
  return ok({ id, groupDate: t.group?.travel_date ?? null });
}

/**
 * Quick-add travellers to a group from the group dialog: name (+ optional
 * passport, phone, nationality). Dates and package come from the group.
 */
export async function addTravellersToGroup(groupId: string, rows: QuickTravellerInput[]): Promise<ActionResult<{ created: number; failed: { row: number; error: string }[] }>> {
  await requireProfile();
  if (!Array.isArray(rows) || rows.length === 0) return ok({ created: 0, failed: [] });
  if (rows.length > 200) return fail("Add at most 200 travellers at a time");
  const supabase = await createClient();
  const { data: g } = await supabase.from("travel_groups").select("id, travel_date, travel_end_date, package_tier, hotel_name, hotel_stars, transit_location").eq("id", groupId).maybeSingle();
  if (!g) return fail("Group not found");
  const year = Number(g.travel_date.slice(0, 4));
  const failed: { row: number; error: string }[] = [];
  let created = 0;
  for (let i = 0; i < rows.length; i++) {
    const parsed = quickTravellerSchema.safeParse(rows[i]);
    if (!parsed.success) {
      failed.push({ row: i + 1, error: Object.values(z.flattenError(parsed.error).fieldErrors).flat()[0] ?? "Invalid row" });
      continue;
    }
    const { error } = await supabase.rpc("create_traveller", {
      p_year: year,
      p_traveller: {
        full_name: parsed.data.full_name,
        passport_number: parsed.data.passport_number,
        phone: parsed.data.phone,
        nationality: parsed.data.nationality,
        travel_start_date: g.travel_date,
        travel_end_date: g.travel_end_date,
        travel_group_id: g.id,
        package_tier: g.package_tier,
        hotel_name: g.hotel_name,
        hotel_stars: g.hotel_stars,
        transit_location: g.transit_location,
        status: "documents_pending",
      },
    });
    if (error) failed.push({ row: i + 1, error: errorMessage(error, "Could not create traveller") });
    else created++;
  }
  await revalidateTraveller();
  return ok({ created, failed });
}
