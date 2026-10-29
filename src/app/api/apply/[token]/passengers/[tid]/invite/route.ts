import { NextResponse, type NextRequest } from "next/server";
import { applicationByToken, issuePassengerToken, passengerBelongs } from "@/lib/apply/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST — a personal link for this co-passenger to fill in their own details and upload their own documents. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string; tid: string }> }) {
  const { token, tid } = await params;
  const app = await applicationByToken(token);
  if (!app) return NextResponse.json({ error: "This link is not valid" }, { status: 404 });
  if (app.passengerId) return NextResponse.json({ error: "Only the main applicant can create invite links" }, { status: 403 });
  if (!(await passengerBelongs(app.id, tid))) return NextResponse.json({ error: "Passenger not found" }, { status: 404 });
  const inviteToken = await issuePassengerToken(tid);
  if (!inviteToken) return NextResponse.json({ error: "Could not create the link" }, { status: 500 });
  return NextResponse.json({ ok: true, link: `${request.nextUrl.origin}/apply/p/${inviteToken}` });
}
