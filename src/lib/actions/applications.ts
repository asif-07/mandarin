"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { createGroup } from "@/lib/actions/travel-groups";
import { assignTravellersToGroup } from "@/lib/actions/travellers";
import { errorMessage, fail, ok, type ActionResult } from "@/lib/result";
import { STANDARD_BORDER } from "@/lib/constants";

function revalidate() {
  revalidatePath("/travel/applications");
  revalidatePath("/travel/travellers");
  revalidatePath("/travel");
  revalidatePath("/");
}

/** Mark a customer portal application as reviewed (seen by the team). */
export async function setApplicationReviewed(travellerId: string, reviewed = true): Promise<ActionResult<{ status: string }>> {
  await requireProfile();
  const supabase = await createClient();
  const status = reviewed ? "reviewed" : "submitted";
  const { error } = await supabase.from("travellers").update({ portal_status: status }).eq("id", travellerId).eq("source", "b2c_portal");
  if (error) return fail(errorMessage(error, "Could not update"));
  revalidate();
  return ok({ status });
}

/**
 * Pair-up suggestion accepted: create one of our own groups for the shared
 * window and move the travellers into it (they take the group's dates).
 */
export async function createGroupWithTravellers(travellerIds: string[], dates: { travel_date: string; travel_end_date: string }): Promise<ActionResult<{ id: string; group_code: string; assigned: number }>> {
  await requireProfile();
  const ids = [...new Set(travellerIds)].filter((id) => z.string().uuid().safeParse(id).success);
  if (ids.length === 0) return fail("Choose at least one traveller");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dates.travel_date) || !/^\d{4}-\d{2}-\d{2}$/.test(dates.travel_end_date)) return fail("Choose the dates");
  const created = await createGroup({ travel_date: dates.travel_date, travel_end_date: dates.travel_end_date, group_code: "G01", entry_port: STANDARD_BORDER, exit_port: STANDARD_BORDER, reference_prefix: "MR144", label: null, guide_name: null, notes: "Created from the customer applications page", package_tier: null, hotel_name: null, hotel_stars: null, transit_location: null, partner_code: null });
  if (!created.ok) return created;
  const assigned = await assignTravellersToGroup(created.data.id, ids);
  if (!assigned.ok) return fail(`Group ${created.data.group_code} was created but travellers could not be added: ${assigned.error}`);
  revalidate();
  return ok({ id: created.data.id, group_code: created.data.group_code, assigned: assigned.data.assigned });
}

/** Merge suggestion accepted: the traveller joins the existing group and takes its dates. */
export async function joinSuggestedGroup(travellerId: string, groupId: string): Promise<ActionResult<{ assigned: number }>> {
  await requireProfile();
  const res = await assignTravellersToGroup(groupId, [travellerId]);
  if (res.ok) revalidate();
  return res;
}
