import { NextResponse, type NextRequest } from "next/server";
import { VISA_COOKIE, lookupVisaMemberByKey, portalCookieOptions } from "@/lib/portal/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let key = "";
  try {
    key = String(((await request.json()) as { key?: string }).key ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Enter your access key" }, { status: 400 });
  }
  const member = await lookupVisaMemberByKey(key);
  if (!member) {
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json({ error: "That access key is not recognised" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true, member: { code: member.code, name: member.name, role: member.role } });
  res.cookies.set(VISA_COOKIE, key, portalCookieOptions());
  return res;
}
