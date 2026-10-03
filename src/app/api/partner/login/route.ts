import { NextResponse, type NextRequest } from "next/server";
import { B2B_COOKIE, lookupPortalPartnerByKey, portalCookieOptions } from "@/lib/portal/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let key = "";
  try {
    key = String(((await request.json()) as { key?: string }).key ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Enter your access key" }, { status: 400 });
  }
  const partner = await lookupPortalPartnerByKey(key);
  if (!partner) {
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json({ error: "That access key is not recognised, or the portal is switched off for your agency" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true, partner: { code: partner.code, name: partner.name } });
  res.cookies.set(B2B_COOKIE, key, portalCookieOptions());
  return res;
}
