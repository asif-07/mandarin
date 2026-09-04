import { z } from "zod";
import { isValidPhoneNumber } from "libphonenumber-js";
import { ACCEPTED_UPLOAD_TYPES, DOC_TYPES, MAX_UPLOAD_BYTES, PACKAGE_TIERS, TRAVELLER_STATUSES } from "@/lib/constants";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date");

const optionalText = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));

const optionalUuid = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => !v || z.string().uuid().safeParse(v).success, "Invalid reference");

const referencePrefix = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{2,12}$/, "Letters and digits only, e.g. MR144")
  .optional()
  .nullable()
  .transform((v) => (v ? v : "MR144"));

export const groupSchema = z
  .object({
    travel_date: dateStr,
    travel_end_date: dateStr,
    group_code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^G\d{2}$/, "Use the format G01"),
    reference_prefix: referencePrefix,
    label: optionalText,
    guide_name: optionalText,
    notes: optionalText,
  })
  .refine((v) => v.travel_end_date >= v.travel_date, {
    message: "End date must be on or after the start date",
    path: ["travel_end_date"],
  });
export type GroupInput = z.input<typeof groupSchema>;
export type GroupValues = z.output<typeof groupSchema>;

export const bulkGroupSchema = z
  .object({
    travel_date: dateStr,
    travel_end_date: dateStr,
    count: z.coerce.number().int().min(1).max(30),
    reference_prefix: referencePrefix,
    label: optionalText,
    guide_name: optionalText,
  })
  .refine((v) => v.travel_end_date >= v.travel_date, {
    message: "End date must be on or after the start date",
    path: ["travel_end_date"],
  });
export type BulkGroupInput = z.input<typeof bulkGroupSchema>;

export const travellerSchema = z
  .object({
    full_name: z.string().trim().min(1, "Name is required").max(200),
    phone: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform((v) => (v ? v : null))
      .refine((v) => !v || isValidPhoneNumber(v), "Enter a valid phone number with country code"),
    email: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform((v) => (v ? v : null))
      .refine((v) => !v || z.string().email().safeParse(v).success, "Enter a valid email"),
    passport_number: z
      .string()
      .trim()
      .toUpperCase()
      .max(30)
      .optional()
      .nullable()
      .transform((v) => (v ? v : null)),
    nationality: optionalText,
    travel_start_date: dateStr,
    travel_end_date: dateStr,
    travel_group_id: optionalUuid,
    visa_reference: optionalText,
    status: z.enum(TRAVELLER_STATUSES.map((s) => s.value) as [string, ...string[]]).default("documents_pending"),
    package_tier: z
      .enum(PACKAGE_TIERS.map((t) => t.value) as [string, ...string[]])
      .optional()
      .nullable()
      .transform((v) => (v ? v : null)),
    notes: optionalText,
    lead_id: optionalUuid,
    invoice_id: optionalUuid,
    customer_id: optionalUuid,
  })
  .refine((v) => v.travel_end_date >= v.travel_start_date, {
    message: "End date must be on or after the start date",
    path: ["travel_end_date"],
  });
export type TravellerInput = z.input<typeof travellerSchema>;
export type TravellerValues = z.output<typeof travellerSchema>;

export const ACCEPTED_MIME = Object.keys(ACCEPTED_UPLOAD_TYPES);
export const ACCEPTED_EXT = Object.values(ACCEPTED_UPLOAD_TYPES).flat();

export const registerDocumentSchema = z.object({
  doc_type: z.enum(DOC_TYPES.map((d) => d.value) as [string, ...string[]]),
  file_name: z.string().trim().min(1).max(255),
  storage_path: z.string().min(1).max(500),
  mime_type: z.enum(ACCEPTED_MIME as [string, ...string[]], { error: "Unsupported file type" }),
  file_size: z.number().int().min(1).max(MAX_UPLOAD_BYTES, "File is larger than 15 MB"),
});
export type RegisterDocumentInput = z.input<typeof registerDocumentSchema>;

/** Client-side pre-check so users get an immediate, clear error. */
export function checkUploadFile(file: File): { ok: true; mime: string } | { ok: false; error: string } {
  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
  let mime = file.type;
  if (!ACCEPTED_MIME.includes(mime)) {
    // Browsers often report an empty type for HEIC; infer from the extension.
    const inferred = Object.entries(ACCEPTED_UPLOAD_TYPES).find(([, exts]) => exts.includes(ext))?.[0];
    if (!inferred) return { ok: false, error: `${file.name}: only PDF, JPG, PNG or HEIC files are accepted` };
    mime = inferred;
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: `${file.name}: larger than 15 MB (${(file.size / 1024 / 1024).toFixed(1)} MB)` };
  }
  return { ok: true, mime };
}

/** Guess the document slot from the filename ("passport.jpg", "PAR-scan.pdf", "hotel booking.pdf"). */
export function guessDocType(fileName: string): string | null {
  const name = fileName.toLowerCase();
  for (const d of DOC_TYPES) {
    if (d.keywords.some((k) => name.includes(k))) return d.value;
  }
  return null;
}
