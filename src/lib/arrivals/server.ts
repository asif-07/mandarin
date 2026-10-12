import "server-only";
import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ArrivalRequestRow } from "@/lib/arrivals/shared";

export function newArrivalRef(date: string): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const b = randomBytes(4);
  return `HKA-${date.replace(/-/g, "")}-${[...b].map((x) => alphabet[x % alphabet.length]).join("")}`;
}

export function newArrivalToken(): string {
  return randomBytes(24).toString("base64url");
}

const COLS = "id, ref, token, partner_code, arrival_date, arrival_time, airline_flight, pax, agent_name, agent_phone, agent_notes, status, admin_reply, replied_at, replied_by, group_id, created_at, group:travel_groups(group_ref)";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function map(r: any): ArrivalRequestRow {
  const { group, ...rest } = r;
  return { ...rest, arrival_time: String(r.arrival_time).slice(0, 5), group_ref: group?.group_ref ?? null };
}

export async function loadArrivalByToken(token: string): Promise<ArrivalRequestRow | null> {
  if (!token || token.length < 16 || token.length > 64) return null;
  const supabase = createAdminClient();
  const { data } = await supabase.from("arrival_requests").select(COLS).eq("token", token).maybeSingle();
  return data ? map(data) : null;
}

export async function listArrivals(opts: { from?: string; to?: string; status?: string; partner?: string } = {}): Promise<ArrivalRequestRow[]> {
  const supabase = createAdminClient();
  let q = supabase.from("arrival_requests").select(COLS).order("arrival_date").order("arrival_time").limit(1000);
  if (opts.from) q = q.gte("arrival_date", opts.from);
  if (opts.to) q = q.lte("arrival_date", opts.to);
  if (opts.status) q = q.eq("status", opts.status);
  if (opts.partner) q = q.eq("partner_code", opts.partner);
  const { data } = await q;
  return (data ?? []).map(map);
}

export async function countNewArrivals(): Promise<number> {
  const supabase = createAdminClient();
  const { count } = await supabase.from("arrival_requests").select("id", { count: "exact", head: true }).eq("status", "new");
  return count ?? 0;
}
