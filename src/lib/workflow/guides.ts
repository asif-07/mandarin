import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** Guide / staff master shared by the company settings page and the visa team extension. */
export type GuideRow = { id: string; name: string; phone: string | null; role: string; languages: string | null; notes: string | null; active: boolean };
export type GuideInput = { name: string; phone?: string | null; role?: string | null; languages?: string | null; notes?: string | null; active?: boolean };

export async function listGuides(activeOnly = false): Promise<GuideRow[]> {
  const supabase = createAdminClient();
  let q = supabase.from("guides").select("id, name, phone, role, languages, notes, active").order("name");
  if (activeOnly) q = q.eq("active", true);
  const { data } = await q;
  return data ?? [];
}

export async function upsertGuide(id: string | null, input: GuideInput): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Guide name is required" };
  const supabase = createAdminClient();
  const row = { name, phone: input.phone?.trim() || null, role: input.role?.trim() || "guide", languages: input.languages?.trim() || null, notes: input.notes?.trim() || null, active: input.active ?? true };
  const req = id ? supabase.from("guides").update(row).eq("id", id).select("id").single() : supabase.from("guides").insert(row).select("id").single();
  const { data, error } = await req;
  if (error || !data) return { ok: false, error: error?.message ?? "Could not save the guide" };
  if (id) await supabase.from("travel_groups").update({ guide_name: row.name, guide_phone: row.phone }).eq("guide_id", id);
  return { ok: true, id: data.id };
}
