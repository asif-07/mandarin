import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { applicationByToken } from "@/lib/apply/server";
import { email, optDate, phone } from "@/lib/apply/validation";
import { checkTransitDates } from "@/lib/apply/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  contact_name: z.string().trim().min(2, "Enter the contact name").max(200),
  contact_phone: phone,
  contact_email: email,
  travel_start_date: optDate,
  travel_end_date: optDate,
  pax: z.coerce.number().int().min(1).max(99).optional().nullable(),
});

/** PATCH — contact details, trip dates and how many travel together. Dates move every passenger not yet placed in a group. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const app = await applicationByToken(token);
  if (!app) return NextResponse.json({ error: "This link is not valid" }, { status: 404 });
  if (app.passengerId) return NextResponse.json({ error: "Only the main applicant can change the trip details" }, { status: 403 });
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Please check the details" }, { status: 400 });
  const v = parsed.data;
  const supabase = createAdminClient();
  const patch: { contact_name: string; contact_phone: string | null; contact_email: string | null; pax?: number | null; travel_start_date?: string; travel_end_date?: string } = { contact_name: v.contact_name, contact_phone: v.contact_phone, contact_email: v.contact_email };
  if (v.pax !== undefined) patch.pax = v.pax;
  let datesLocked = false;
  if (v.travel_start_date && v.travel_end_date && (v.travel_start_date !== app.travel_start_date || v.travel_end_date !== app.travel_end_date)) {
    const problem = checkTransitDates(v.travel_start_date, v.travel_end_date);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });
    const { count } = await supabase.from("travellers").select("id", { count: "exact", head: true }).eq("portal_application_id", app.id).not("travel_group_id", "is", null);
    if (app.travel_group_id || (count ?? 0) > 0) datesLocked = true;
    else {
      patch.travel_start_date = v.travel_start_date;
      patch.travel_end_date = v.travel_end_date;
      await supabase.from("travellers").update({ travel_start_date: v.travel_start_date, travel_end_date: v.travel_end_date }).eq("portal_application_id", app.id).is("travel_group_id", null);
    }
  }
  const { error } = await supabase.from("portal_applications").update(patch).eq("id", app.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, datesLocked });
}
