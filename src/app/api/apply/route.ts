import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isValidPhoneNumber } from "libphonenumber-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { newPortalToken } from "@/lib/apply/server";
import { todayISO } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z
  .object({
    full_name: z.string().trim().min(2, "Enter your name as in the passport").max(200),
    phone: z
      .string()
      .trim()
      .min(5, "Enter your phone number with country code")
      .max(40)
      .refine((v) => isValidPhoneNumber(v), "Enter a valid phone number with country code, e.g. +971 50 123 4567"),
    email: z
      .string()
      .trim()
      .max(200)
      .optional()
      .nullable()
      .transform((v) => v || null)
      .refine((v) => !v || z.string().email().safeParse(v).success, "Enter a valid email"),
    nationality: z.string().trim().max(60).optional().nullable().transform((v) => v || null),
    travel_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose your entry date"),
    travel_end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose your exit date"),
    website: z.string().optional(), // honeypot
  })
  .refine((v) => v.travel_end_date >= v.travel_start_date, { message: "The exit date must be on or after the entry date", path: ["travel_end_date"] });

/** POST — a customer starts an application (no login). Creates the traveller with a private link token. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Please check the details" }, { status: 400 });
  const v = parsed.data;
  if (v.website) return NextResponse.json({ ok: true, token: "" });
  if (v.travel_start_date < todayISO()) return NextResponse.json({ error: "The entry date is in the past" }, { status: 400 });

  const supabase = createAdminClient();
  const token = newPortalToken();
  const year = Number(v.travel_start_date.slice(0, 4));
  const { data: id, error } = await supabase.rpc("create_traveller", {
    p_year: year,
    p_traveller: {
      full_name: v.full_name,
      phone: v.phone,
      email: v.email,
      nationality: v.nationality,
      travel_start_date: v.travel_start_date,
      travel_end_date: v.travel_end_date,
      status: "documents_pending",
      notes: "Applied through the customer portal",
      source: "b2c_portal",
      portal_token: token,
      portal_status: "draft",
    },
  });
  if (error || !id) return NextResponse.json({ error: error?.message ?? "Could not start the application" }, { status: 500 });
  return NextResponse.json({ ok: true, token });
}
