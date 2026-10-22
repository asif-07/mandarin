import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isValidPhoneNumber } from "libphonenumber-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { applicantIdByToken } from "@/lib/apply/server";
import type { Database, Json } from "@/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const text = (max: number) => z.string().trim().max(max).optional().nullable().transform((v) => v || null);
const date = z
  .string()
  .optional()
  .nullable()
  .transform((v) => v || null)
  .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), "Use a full date");

const schema = z.object({
  full_name: z.string().trim().min(2, "Enter your name as in the passport").max(200),
  phone: text(40).refine((v) => !v || isValidPhoneNumber(v), "Enter a valid phone number with country code"),
  email: text(200).refine((v) => !v || z.string().email().safeParse(v).success, "Enter a valid email"),
  nationality: text(60),
  passport_number: z
    .string()
    .trim()
    .toUpperCase()
    .max(30)
    .optional()
    .nullable()
    .transform((v) => v || null)
    .refine((v) => !v || /^[A-Z0-9]{5,15}$/.test(v), "Passport number: letters and digits only"),
  date_of_birth: date,
  sex: z
    .string()
    .optional()
    .nullable()
    .transform((v) => v || null)
    .refine((v) => !v || ["M", "F", "X"].includes(v), "Choose M, F or X"),
  passport_expiry: date,
  address: text(1000),
  pan_number: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .nullable()
    .transform((v) => v || null)
    .refine((v) => !v || /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(v), "PAN looks like ABCDE1234F"),
  travel_start_date: date,
  travel_end_date: date,
  passport_ocr: z.record(z.string(), z.unknown()).optional().nullable(),
});

/** PATCH — the customer saves their details (passport data read by OCR and checked by them, address, PAN). */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const applicant = await applicantIdByToken(token);
  if (!applicant) return NextResponse.json({ error: "This link is not valid" }, { status: 404 });
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Please check the details" }, { status: 400 });
  const v = parsed.data;

  const supabase = createAdminClient();
  const { data: cur } = await supabase.from("travellers").select("travel_group_id, travel_start_date, travel_end_date").eq("id", applicant.id).single();
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
  // Dates can change until we put the customer in a group (then the group decides).
  if (!cur?.travel_group_id && v.travel_start_date && v.travel_end_date) {
    if (v.travel_end_date < v.travel_start_date) return NextResponse.json({ error: "The exit date must be on or after the entry date" }, { status: 400 });
    patch.travel_start_date = v.travel_start_date;
    patch.travel_end_date = v.travel_end_date;
  }
  const { error } = await supabase.from("travellers").update(patch).eq("id", applicant.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, datesLocked: !!cur?.travel_group_id });
}
