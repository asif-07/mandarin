import { NextResponse, type NextRequest } from "next/server";
import { applicationByToken, createPassenger, issuePassengerToken, loadPassenger } from "@/lib/apply/server";
import { fullName, passengerSchema } from "@/lib/apply/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST — add a co-passenger. With { invite: true } a personal link is issued so they fill in their own details. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const app = await applicationByToken(token);
  if (!app) return NextResponse.json({ error: "This link is not valid" }, { status: 404 });
  if (app.passengerId) return NextResponse.json({ error: "Only the main applicant can add co-passengers" }, { status: 403 });
  const body = (await request.json().catch(() => null)) as { invite?: boolean } | null;
  const parsed = passengerSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Please check the details" }, { status: 400 });
  const v = parsed.data;
  const res = await createPassenger(app, { ...v, full_name: fullName(v.given_name, v.surname) });
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: 500 });
  let inviteToken: string | null = null;
  if (body?.invite) inviteToken = await issuePassengerToken(res.id);
  const passenger = await loadPassenger(app.id, res.id);
  return NextResponse.json({ ok: true, passenger, invite_link: inviteToken ? `${request.nextUrl.origin}/apply/p/${inviteToken}` : null });
}
