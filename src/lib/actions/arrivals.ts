"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { ARRIVAL_STATUSES } from "@/lib/arrivals/shared";
import { errorMessage, fail, ok, type ActionResult } from "@/lib/result";

function revalidate() {
  revalidatePath("/travel/arrivals");
  revalidatePath("/travel/b2b");
  revalidatePath("/");
}

/** CTS reply to an agent's arrival submission; shown on their tracking page. */
export async function replyToArrival(id: string, reply: string, status: "replied" | "confirmed" = "replied"): Promise<ActionResult<{ id: string }>> {
  const profile = await requireProfile();
  const text = reply.trim();
  if (!text) return fail("Write the reply first");
  if (text.length > 4000) return fail("Reply is too long");
  const supabase = await createClient();
  const { error } = await supabase.from("arrival_requests").update({ admin_reply: text, replied_at: new Date().toISOString(), replied_by: profile.display_name, status }).eq("id", id);
  if (error) return fail(errorMessage(error, "Could not save the reply"));
  revalidate();
  return ok({ id });
}

export async function setArrivalStatus(id: string, status: string): Promise<ActionResult<{ status: string }>> {
  await requireProfile();
  if (!ARRIVAL_STATUSES.some((s) => s.value === status)) return fail("Invalid status");
  const supabase = await createClient();
  const { error } = await supabase.from("arrival_requests").update({ status }).eq("id", id);
  if (error) return fail(errorMessage(error, "Could not update"));
  revalidate();
  return ok({ status });
}

/** Attach the arrival to a group (or detach with null) so same-day arrivals can be grouped for the transfer. */
export async function attachArrivalToGroup(id: string, groupId: string | null): Promise<ActionResult<{ id: string }>> {
  await requireProfile();
  if (groupId && !z.string().uuid().safeParse(groupId).success) return fail("Invalid group");
  const supabase = await createClient();
  const { error } = await supabase.from("arrival_requests").update({ group_id: groupId }).eq("id", id);
  if (error) return fail(errorMessage(error, "Could not attach"));
  revalidate();
  return ok({ id });
}
