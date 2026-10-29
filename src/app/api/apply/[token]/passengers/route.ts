import { NextResponse, type NextRequest } from "next/server";
import { applicationByToken, createPassenger, loadPassenger } from "@/lib/apply/server";
import { passengerSchema } from "@/lib/apply/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST — add a passenger (a co-passenger for a customer, one of the group for an agent). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const app = await applicationByToken(token);
  if (!app) return NextResponse.json({ error: "This link is not valid" }, { status: 404 });
  const body = await request.json().catch(() => null);
  const parsed = passengerSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Please check the details" }, { status: 400 });
  const res = await createPassenger(app, parsed.data);
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: 500 });
  const passenger = await loadPassenger(app.id, res.id);
  return NextResponse.json({ ok: true, passenger });
}
