import { NextResponse } from "next/server";
import { PARTNER_COOKIE, partnerCookieOptions } from "@/lib/scanner/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(PARTNER_COOKIE, "", { ...partnerCookieOptions(), maxAge: 0 });
  return res;
}
