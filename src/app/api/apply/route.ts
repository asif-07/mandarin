import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isValidPhoneNumber } from "libphonenumber-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPassenger, newPortalToken } from "@/lib/apply/server";
import { email, optText } from "@/lib/apply/validation";
import { fullName } from "@/lib/apply/validation";
import { checkTransitDates } from "@/lib/apply/shared";
import { todayISO } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  given_name: z.string().trim().min(1, "Enter your given name as in the passport").max(120),
  surname: z.string().trim().min(1, "Enter your surname as in the passport").max(120),
  phone: z
    .string()
    .trim()
    .min(5, "Enter the phone number with country code")
    .max(40)
    .refine((v) => isValidPhoneNumber(v), "Enter a valid phone number with country code, e.g. +971 50 123 4567"),
  email,
  nationality: optText(60),
  travel_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the expected entry date"),
  travel_end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the expected exit date"),
  pax: z.coerce.number().int().min(1, "How many travel together?").max(99),
  website: z.string().optional(), // honeypot
});

/**
 * POST — a traveller starts a 144-hour transit visa application (no login).
 * They become the first passenger; co-passengers are added on the next page.
 * Returns the private link token.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Please check the details" }, { status: 400 });
  const v = parsed.data;
  if (v.website) return NextResponse.json({ ok: true, token: "" });
  if (v.travel_start_date < todayISO()) return NextResponse.json({ error: "The entry date is in the past" }, { status: 400 });
  const dateProblem = checkTransitDates(v.travel_start_date, v.travel_end_date);
  if (dateProblem) return NextResponse.json({ error: dateProblem }, { status: 400 });

  const supabase = createAdminClient();
  const token = newPortalToken();
  const name = fullName(v.given_name, v.surname);
  const { data: app, error } = await supabase
    .from("portal_applications")
    .insert({ token, kind: "b2c", contact_name: name, contact_phone: v.phone, contact_email: v.email, nationality: v.nationality, travel_start_date: v.travel_start_date, travel_end_date: v.travel_end_date, pax: v.pax })
    .select("id, kind, status, contact_name, contact_email, contact_phone, agency_name, nationality, travel_start_date, travel_end_date, pax, travel_group_id, submitted_at")
    .single();
  if (error || !app) return NextResponse.json({ error: error?.message ?? "Could not start the application" }, { status: 500 });
  const res = await createPassenger({ ...app, kind: "b2c" }, { full_name: name, given_name: v.given_name, surname: v.surname, phone: v.phone, email: v.email, nationality: v.nationality });
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: 500 });
  return NextResponse.json({ ok: true, token });
}
