import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { applicationByToken, loadPassenger, passengerBelongs } from "@/lib/apply/server";
import { passengerSchema } from "@/lib/apply/validation";
import type { Database, Json } from "@/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PATCH — a passenger's details (passport data checked by the uploader, address, PAN). */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ token: string; tid: string }> }) {
  const { token, tid } = await params;
  const app = await applicationByToken(token);
  if (!app) return NextResponse.json({ error: "This link is not valid" }, { status: 404 });
  if (!(await passengerBelongs(app.id, tid))) return NextResponse.json({ error: "Passenger not found" }, { status: 404 });
  const body = await request.json().catch(() => null);
  const parsed = passengerSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Please check the details" }, { status: 400 });
  const v = parsed.data;
  const patch: Database["public"]["Tables"]["travellers"]["Update"] = {
    full_name: v.full_name,
    phone: v.phone,
    email: v.email,
    nationality: v.nationality,
    passport_number: v.passport_number,
    date_of_birth: v.date_of_birth,
    sex: v.sex,
    passport_expiry: v.passport_expiry,
    address: v.address,
    pan_number: v.pan_number,
  };
  if (v.passport_ocr) patch.passport_ocr = v.passport_ocr as Json;
  const supabase = createAdminClient();
  const { error } = await supabase.from("travellers").update(patch).eq("id", tid);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, passenger: await loadPassenger(app.id, tid) });
}

/** DELETE — remove a passenger added by mistake (not once we have placed them in a group). */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ token: string; tid: string }> }) {
  const { token, tid } = await params;
  const app = await applicationByToken(token);
  if (!app) return NextResponse.json({ error: "This link is not valid" }, { status: 404 });
  const p = await passengerBelongs(app.id, tid);
  if (!p) return NextResponse.json({ error: "Passenger not found" }, { status: 404 });
  if (p.travel_group_id) return NextResponse.json({ error: "This passenger is already in a travel group. Contact us to remove them." }, { status: 409 });
  const supabase = createAdminClient();
  const { error } = await supabase.from("travellers").delete().eq("id", tid);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
