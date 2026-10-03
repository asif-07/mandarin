import { NextResponse } from "next/server";
import { VISA_COOKIE, portalCookieOptions } from "@/lib/portal/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(VISA_COOKIE, "", { ...portalCookieOptions(), maxAge: 0 });
  return res;
}
