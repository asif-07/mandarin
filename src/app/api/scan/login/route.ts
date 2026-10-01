import { NextResponse, type NextRequest } from "next/server";
import { PARTNER_COOKIE, lookupPartnerByKey, partnerCookieOptions } from "@/lib/scanner/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { key } — partner signs in to the scanner with their access key. The key is kept in an httpOnly cookie. */
export async function POST(request: NextRequest) {
  let key = "";
  try {
    const body = (await request.json()) as { key?: string };
    key = String(body.key ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Enter your access key" }, { status: 400 });
  }
  const partner = await lookupPartnerByKey(key);
  if (!partner) {
    // Slow down guessing a little; keys are 24 random characters so this is belt and braces.
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json({ error: "That access key is not recognised" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true, partner });
  res.cookies.set(PARTNER_COOKIE, key, partnerCookieOptions());
  return res;
}
