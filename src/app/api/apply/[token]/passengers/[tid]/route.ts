import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { applicationByToken, loadPassenger, passengerBelongs } from "@/lib/apply/server";
import { fullName, passengerSchema } from "@/lib/apply/validation";
import { notify } from "@/lib/workflow/engine";
import { formatDate } from "@/lib/format";
import type { Database, Json } from "@/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PATCH — a passenger's details (passport data checked by the uploader, address, PAN, the PAR answer). */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ token: string; tid: string }> }) {
  const { token, tid } = await params;
  const app = await applicationByToken(token);
  if (!app) return NextResponse.json({ error: "This link is not valid" }, { status: 404 });
  if (app.passengerId && app.passengerId !== tid) return NextResponse.json({ error: "This link is for another passenger" }, { status: 403 });
  const current = await passengerBelongs(app.id, tid);
  if (!current) return NextResponse.json({ error: "Passenger not found" }, { status: 404 });
  const body = await request.json().catch(() => null);
  const parsed = passengerSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Please check the details" }, { status: 400 });
  const v = parsed.data;
  const supabase = createAdminClient();
  const { data: before } = await supabase.from("travellers").select("par_answer, par_requested_at, traveller_ref, given_name, surname, full_name").eq("id", tid).single();
  // After submission the name is fixed (it is what the visa is applied for); everything else can still be corrected.
  const locked = app.status === "submitted" || app.status === "reviewed";
  if (locked && before && ((before.given_name ?? "") !== v.given_name || (before.surname ?? "") !== (v.surname ?? ""))) {
    return NextResponse.json({ error: "The name cannot be changed after submission. Contact us if the passport name is wrong." }, { status: 409 });
  }
  const patch: Database["public"]["Tables"]["travellers"]["Update"] = {
    full_name: fullName(v.given_name, v.surname),
    given_name: v.given_name,
    surname: v.surname,
    phone: v.phone,
    email: v.email,
    nationality: v.nationality,
    passport_number: v.passport_number,
    date_of_birth: v.date_of_birth,
    sex: v.sex,
    passport_expiry: v.passport_expiry,
    address: v.address,
    pan_number: v.pan_number,
    par_answer: v.par_answer,
  };
  if (v.passport_ocr) patch.passport_ocr = v.passport_ocr as Json;
  // "I do not have the PAR": tell the PAR team once, so they apply for it.
  const askPar = v.par_answer === "needs_par" && !before?.par_requested_at;
  if (askPar) patch.par_requested_at = new Date().toISOString();
  const { error } = await supabase.from("travellers").update(patch).eq("id", tid);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (askPar) {
    await notify(supabase, [{ audience: "company" }], null, `PAR to apply: ${patch.full_name}`, `${before?.traveller_ref ?? ""} · ${v.passport_number ?? "passport number pending"} · travelling ${formatDate(app.travel_start_date)} to ${formatDate(app.travel_end_date)} · applicant ${app.contact_name}${app.contact_phone ? ` (${app.contact_phone})` : ""}. The traveller has no Hong Kong Pre-Arrival Registration: please apply for it.`);
  }
  return NextResponse.json({ ok: true, passenger: await loadPassenger(app.id, tid) });
}

/** DELETE — remove a passenger added by mistake (not once we have placed them in a group). */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ token: string; tid: string }> }) {
  const { token, tid } = await params;
  const app = await applicationByToken(token);
  if (!app) return NextResponse.json({ error: "This link is not valid" }, { status: 404 });
  if (app.passengerId) return NextResponse.json({ error: "Only the main applicant can remove passengers" }, { status: 403 });
  const p = await passengerBelongs(app.id, tid);
  if (!p) return NextResponse.json({ error: "Passenger not found" }, { status: 404 });
  if (p.travel_group_id) return NextResponse.json({ error: "This passenger is already in a travel group. Contact us to remove them." }, { status: 409 });
  const supabase = createAdminClient();
  const { error } = await supabase.from("travellers").delete().eq("id", tid);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
