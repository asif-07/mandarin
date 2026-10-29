import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isValidPhoneNumber } from "libphonenumber-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPassenger, newPortalToken } from "@/lib/apply/server";
import { email, optText } from "@/lib/apply/validation";
import { todayISO } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z
  .object({
    kind: z.enum(["b2c", "b2b"]).default("b2c"),
    contact_name: z.string().trim().min(2, "Enter the name").max(200),
    agency_name: optText(200),
    phone: z
      .string()
      .trim()
      .min(5, "Enter the phone number with country code")
      .max(40)
      .refine((v) => isValidPhoneNumber(v), "Enter a valid phone number with country code, e.g. +971 50 123 4567"),
    email,
    nationality: optText(60),
    travel_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the entry date"),
    travel_end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the exit date"),
    website: z.string().optional(), // honeypot
  })
  .refine((v) => v.travel_end_date >= v.travel_start_date, { message: "The exit date must be on or after the entry date", path: ["travel_end_date"] })
  .refine((v) => v.kind !== "b2b" || !!v.agency_name, { message: "Enter the agency name", path: ["agency_name"] });

/**
 * POST — start an application (no login, no partner code). A customer (b2c)
 * is created as the first passenger; an agent (b2b) adds passengers by bulk
 * upload afterwards. Returns the private link token.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Please check the details" }, { status: 400 });
  const v = parsed.data;
  if (v.website) return NextResponse.json({ ok: true, token: "" });
  if (v.travel_start_date < todayISO()) return NextResponse.json({ error: "The entry date is in the past" }, { status: 400 });

  const supabase = createAdminClient();
  const token = newPortalToken();
  const { data: app, error } = await supabase
    .from("portal_applications")
    .insert({ token, kind: v.kind, contact_name: v.contact_name, contact_phone: v.phone, contact_email: v.email, agency_name: v.kind === "b2b" ? v.agency_name : null, nationality: v.nationality, travel_start_date: v.travel_start_date, travel_end_date: v.travel_end_date })
    .select("id, kind, status, contact_name, contact_email, contact_phone, agency_name, nationality, travel_start_date, travel_end_date, travel_group_id, submitted_at")
    .single();
  if (error || !app) return NextResponse.json({ error: error?.message ?? "Could not start the application" }, { status: 500 });
  if (v.kind === "b2c") {
    const res = await createPassenger({ ...app, kind: "b2c" }, { full_name: v.contact_name, phone: v.phone, email: v.email, nationality: v.nationality });
    if ("error" in res) return NextResponse.json({ error: res.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, token });
}
