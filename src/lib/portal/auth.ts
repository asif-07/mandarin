import "server-only";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashAccessKey, partnerCookieOptions } from "@/lib/scanner/auth";

/**
 * Key-based sign-in for the two external portals, on the same pattern as the
 * voucher scanner: the key lives in an httpOnly cookie and is checked against
 * its hash on every request. Portal pages run server-side with the service
 * role after this check, so no database credentials reach the browser.
 */
export const B2B_COOKIE = "cts_b2b";
export const VISA_COOKIE = "cts_visa";

export type PortalPartner = { id: string; code: string; name: string; email: string | null; logo_path: string | null };
export type VisaMember = { id: string; code: string; name: string; role: string; phone: string | null; guide_id: string | null };

export async function lookupPortalPartnerByKey(key: string): Promise<PortalPartner | null> {
  if (!key || key.length < 12 || key.length > 200) return null;
  const supabase = createAdminClient();
  const { data } = await supabase.from("b2b_partners").select("id, code, name, email, logo_path, portal_active").eq("portal_key_hash", hashAccessKey(key)).maybeSingle();
  if (!data || !data.portal_active) return null;
  void supabase.from("b2b_partners").update({ portal_last_seen_at: new Date().toISOString() }).eq("id", data.id).then(() => undefined);
  return { id: data.id, code: data.code, name: data.name ?? data.code, email: data.email, logo_path: data.logo_path };
}

export async function getPortalPartner(): Promise<PortalPartner | null> {
  const key = (await cookies()).get(B2B_COOKIE)?.value;
  return key ? lookupPortalPartnerByKey(key) : null;
}

export async function lookupVisaMemberByKey(key: string): Promise<VisaMember | null> {
  if (!key || key.length < 12 || key.length > 200) return null;
  const supabase = createAdminClient();
  const { data } = await supabase.from("visa_team_members").select("id, code, name, role, phone, guide_id, active").eq("access_key_hash", hashAccessKey(key)).maybeSingle();
  if (!data || !data.active) return null;
  void supabase.from("visa_team_members").update({ last_seen_at: new Date().toISOString() }).eq("id", data.id).then(() => undefined);
  return { id: data.id, code: data.code, name: data.name, role: data.role, phone: data.phone, guide_id: data.guide_id };
}

export async function getVisaMember(): Promise<VisaMember | null> {
  const key = (await cookies()).get(VISA_COOKIE)?.value;
  return key ? lookupVisaMemberByKey(key) : null;
}

export { partnerCookieOptions as portalCookieOptions };
