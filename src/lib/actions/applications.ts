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

/** Mark a portal application as reviewed (seen by the team), or back to submitted. */
export async function setApplicationReviewed(applicationId: string, reviewed = true): Promise<ActionResult<{ status: string }>> {
  await requireProfile();
  const supabase = await createClient();
  const status = reviewed ? "reviewed" : "submitted";
  const { error } = await supabase.from("portal_applications").update({ status }).eq("id", applicationId);
  if (error) return fail(errorMessage(error, "Could not update"));
  await supabase.from("travellers").update({ portal_status: status }).eq("portal_application_id", applicationId);
  revalidate();
  return ok({ status });
}

/** Note the group an application's passengers went into, so the portal page can say so. */
async function linkApplicationsToGroup(supabase: Awaited<ReturnType<typeof createClient>>, travellerIds: string[], groupId: string) {
  const { data } = await supabase.from("travellers").select("portal_application_id").in("id", travellerIds).not("portal_application_id", "is", null);
  const appIds = [...new Set((data ?? []).map((t) => t.portal_application_id).filter((x): x is string => !!x))];
  for (const id of appIds) {
    // Only when every passenger of that application is now in this group.
    const { count } = await supabase.from("travellers").select("id", { count: "exact", head: true }).eq("portal_application_id", id).neq("status", "cancelled").or(`travel_group_id.is.null,travel_group_id.neq.${groupId}`);
    if ((count ?? 0) === 0) await supabase.from("portal_applications").update({ travel_group_id: groupId }).eq("id", id);
  }
}

/**
 * Create one of our own groups for the given travellers (a pair-up
 * suggestion, or a whole agent application) and move them into it.
 */
export async function createGroupWithTravellers(travellerIds: string[], dates: { travel_date: string; travel_end_date: string }, label?: string | null): Promise<ActionResult<{ id: string; group_code: string; assigned: number }>> {
  await requireProfile();
  const ids = [...new Set(travellerIds)].filter((id) => z.string().uuid().safeParse(id).success);
  if (ids.length === 0) return fail("Choose at least one traveller");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dates.travel_date) || !/^\d{4}-\d{2}-\d{2}$/.test(dates.travel_end_date)) return fail("Choose the dates");
  const created = await createGroup({ travel_date: dates.travel_date, travel_end_date: dates.travel_end_date, group_code: "G01", entry_port: STANDARD_BORDER, exit_port: STANDARD_BORDER, reference_prefix: "MR144", label: label ?? null, guide_name: null, notes: "Created from the applications page", package_tier: null, hotel_name: null, hotel_stars: null, transit_location: null, partner_code: null });
  if (!created.ok) return created;
  const assigned = await assignTravellersToGroup(created.data.id, ids);
  if (!assigned.ok) return fail(`Group ${created.data.group_code} was created but travellers could not be added: ${assigned.error}`);
  const supabase = await createClient();
  await linkApplicationsToGroup(supabase, ids, created.data.id);
  revalidate();
  return ok({ id: created.data.id, group_code: created.data.group_code, assigned: assigned.data.assigned });
}

/** Merge suggestion accepted: the travellers join the existing group and take its dates. */
export async function joinSuggestedGroup(travellerIds: string[], groupId: string): Promise<ActionResult<{ assigned: number }>> {
  await requireProfile();
  const ids = [...new Set(travellerIds)].filter((id) => z.string().uuid().safeParse(id).success);
  if (ids.length === 0) return fail("Choose at least one traveller");
  const res = await assignTravellersToGroup(groupId, ids);
  if (!res.ok) return res;
  const supabase = await createClient();
  await linkApplicationsToGroup(supabase, ids, groupId);
  revalidate();
  return res;
}
