import { z } from "zod";
import { isValidPhoneNumber } from "libphonenumber-js";

/** Zod pieces shared by the portal API routes. */
export const optText = (max: number) => z.string().trim().max(max).optional().nullable().transform((v) => v || null);
export const optDate = z
  .string()
  .optional()
  .nullable()
  .transform((v) => v || null)
  .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), "Use a full date");
export const phone = optText(40).refine((v) => !v || isValidPhoneNumber(v), "Enter a valid phone number with country code");
export const email = optText(200).refine((v) => !v || z.string().email().safeParse(v).success, "Enter a valid email");
export const passportNumber = z
  .string()
  .trim()
  .toUpperCase()
  .max(30)
  .optional()
  .nullable()
  .transform((v) => v || null)
  .refine((v) => !v || /^[A-Z0-9]{5,15}$/.test(v), "Passport number: letters and digits only");
export const panNumber = z
  .string()
  .trim()
  .toUpperCase()
  .optional()
  .nullable()
  .transform((v) => v || null)
  .refine((v) => !v || /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(v), "PAN looks like ABCDE1234F");
export const sex = z
  .string()
  .optional()
  .nullable()
  .transform((v) => v || null)
  .refine((v) => !v || ["M", "F", "X"].includes(v), "Choose M, F or X");

/** Per-passenger details (the fields the passport OCR fills plus address and PAN). */
export const passengerSchema = z.object({
  given_name: z.string().trim().min(1, "Enter the given name as in the passport").max(120),
  surname: z.string().trim().max(120).optional().nullable().transform((v) => v || null),
  phone,
  email,
  nationality: optText(60),
  passport_number: passportNumber,
  date_of_birth: optDate,
  sex,
  passport_expiry: optDate,
  address: optText(1000),
  pan_number: panNumber,
  passport_ocr: z.record(z.string(), z.unknown()).optional().nullable(),
  par_answer: z
    .string()
    .optional()
    .nullable()
    .transform((v) => v || null)
    .refine((v) => !v || v === "has_par" || v === "needs_par", "Answer the PAR question"),
});
export type PassengerInput = z.input<typeof passengerSchema>;

/** Display name from the passport parts: given names then surname. */
export function fullName(given: string, surname: string | null | undefined): string {
  return [given.trim(), (surname ?? "").trim()].filter(Boolean).join(" ");
}
