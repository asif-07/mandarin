import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Partner access for the mobile web scanner. A partner signs in once with the
 * access key they were given; the key is kept in an httpOnly cookie and checked
 * against its hash on every request, so no database credentials ever reach
 * the partner's phone. Vouchers are only readable through these checks.
 */
export const PARTNER_COOKIE = "cts_partner";
const COOKIE_DAYS = 30;

export function hashAccessKey(key: string): string {
  return createHash("sha256").update(key.trim()).digest("hex");
}

/** A new partner access key: CTS- plus 24 random base32-ish characters, easy to type on a phone. */
export function generateAccessKey(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(24);
  let out = "";
  for (let i = 0; i < 24; i++) out += alphabet[bytes[i]! % alphabet.length];
  return `CTS-${out.slice(0, 8)}-${out.slice(8, 16)}-${out.slice(16, 24)}`;
}

/** A voucher token for the QR: 32 random bytes, URL safe, no voucher data inside. */
export function generateVoucherToken(): string {
  return randomBytes(32).toString("base64url");
}

export type ScannerPartner = { id: string; code: string; name: string };

/** The partner behind a scanner request, or null when the cookie is missing, unknown or deactivated. */
export async function getScannerPartner(): Promise<ScannerPartner | null> {
  const jar = await cookies();
  const key = jar.get(PARTNER_COOKIE)?.value;
  if (!key) return null;
  return lookupPartnerByKey(key);
}

export async function lookupPartnerByKey(key: string): Promise<ScannerPartner | null> {
  if (!key || key.length < 12 || key.length > 200) return null;
  const supabase = createAdminClient();
  const { data } = await supabase.from("scanner_partners").select("id, code, name, active").eq("access_key_hash", hashAccessKey(key)).maybeSingle();
  if (!data || !data.active) return null;
  void supabase.from("scanner_partners").update({ last_seen_at: new Date().toISOString() }).eq("id", data.id).then(() => undefined);
  return { id: data.id, code: data.code, name: data.name };
}

export function partnerCookieOptions() {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: COOKIE_DAYS * 86400 };
}
