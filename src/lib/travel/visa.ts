import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

/**
 * Downloading a group's pack means it is being submitted for the visa, so the
 * group (and the travellers in it that are still at the document stage) move
 * to "visa applied". Idempotent: never moves anything backwards.
 */
export async function markGroupVisaApplied(supabase: Client, groupId: string): Promise<void> {
  const now = new Date().toISOString();
  await supabase.from("travel_groups").update({ visa_status: "applied", visa_applied_at: now }).eq("id", groupId).eq("visa_status", "pending");
  await supabase.from("travellers").update({ status: "visa_applied" }).eq("travel_group_id", groupId).in("status", ["documents_pending", "documents_complete"]);
}

/** The visa page has been received: group approved, travellers visa_approved. */
export async function markGroupVisaApproved(supabase: Client, groupId: string): Promise<void> {
  await supabase.from("travellers").update({ status: "visa_approved" }).eq("travel_group_id", groupId).in("status", ["documents_pending", "documents_complete", "visa_applied"]);
}
