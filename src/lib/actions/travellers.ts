"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { travellerSchema, type TravellerInput } from "@/lib/validation/travel";
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
    supabase.from("travellers").select("status").eq("id", travellerId).single(),
    supabase.from("traveller_documents").select("doc_type").eq("traveller_id", travellerId).is("deleted_at", null),
  ]);
  if (!traveller) return null;
  const present = new Set((docs ?? []).map((d) => d.doc_type));
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
