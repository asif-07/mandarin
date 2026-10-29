import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { applicationByToken } from "@/lib/apply/server";
import { email, optDate, optText, phone } from "@/lib/apply/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  contact_name: z.string().trim().min(2, "Enter the contact name").max(200),
  contact_phone: phone,
  contact_email: email,
  agency_name: optText(200),
  travel_start_date: optDate,
  travel_end_date: optDate,
});

/** PATCH — contact details and trip dates of the application. Dates move every passenger not yet placed in a group. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const app = await applicationByToken(token);
  if (!app) return NextResponse.json({ error: "This link is not valid" }, { status: 404 });
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Please check the details" }, { status: 400 });
  const v = parsed.data;
  const supabase = createAdminClient();
  const patch: { contact_name: string; contact_phone: string | null; contact_email: string | null; agency_name?: string | null; travel_start_date?: string; travel_end_date?: string } = { contact_name: v.contact_name, contact_phone: v.contact_phone, contact_email: v.contact_email };
  if (app.kind === "b2b") patch.agency_name = v.agency_name;
  let datesLocked = false;
  if (v.travel_start_date && v.travel_end_date && (v.travel_start_date !== app.travel_start_date || v.travel_end_date !== app.travel_end_date)) {
    if (v.travel_end_date < v.travel_start_date) return NextResponse.json({ error: "The exit date must be on or after the entry date" }, { status: 400 });
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
