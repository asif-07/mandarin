import { z } from "zod";
import { isValidPhoneNumber } from "libphonenumber-js";
import {
  ACTIVITY_TYPES,
  CANTON_PHASES,
  COUNTRIES,
  CURRENCIES,
  ENQUIRY_TYPES,
  LEAD_SOURCES,
  LEAD_STATUSES,
  LOST_REASONS,
} from "@/lib/constants";

const values = <T extends readonly { value: string }[]>(opts: T) => opts.map((o) => o.value) as [string, ...string[]];

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

export const phoneSchema = z
  .string()
  .trim()
  .min(1, "Phone is required")
  .refine((v) => isValidPhoneNumber(v), "Enter a valid phone number with country code");

export const leadSchema = z.object({
  full_name: z.string().trim().min(1, "Name is required").max(200),
  phone: phoneSchema,
  email: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v ? v : null))
    .refine((v) => !v || z.string().email().safeParse(v).success, "Enter a valid email"),
  country: z
    .enum(values(COUNTRIES))
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  city: optionalText,
  entry_city: optionalText,
  enquiry_type: z.enum(values(ENQUIRY_TYPES), { error: "Choose an enquiry type" }),
  source: z.enum(values(LEAD_SOURCES)).default("whatsapp"),
  status: z.enum(values(LEAD_STATUSES)).default("new"),
  pax_count: z.coerce.number().int().min(1).max(999).default(1),
  travel_month: optionalText,
  canton_phase: z
    .enum(values(CANTON_PHASES))
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  quoted_amount: z
    .union([z.coerce.number().min(0).max(99_999_999), z.literal(""), z.null(), z.undefined()])
    .transform((v) => (v === "" || v === undefined || v === null ? null : v)),
  quoted_currency: z.enum(values(CURRENCIES)).default("USD"),
  assigned_to: optionalUuid,
  next_followup_date: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ? v : null))
    .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), "Invalid date"),
  notes: optionalText,
});

export type LeadInput = z.input<typeof leadSchema>;
export type LeadValues = z.output<typeof leadSchema>;

export const leadStatusChangeSchema = z
  .object({
    status: z.enum(values(LEAD_STATUSES)),
    lost_reason: z
      .enum(values(LOST_REASONS))
      .optional()
      .nullable()
      .transform((v) => (v ? v : null)),
    note: optionalText,
  })
  .refine((v) => v.status !== "lost" || !!v.lost_reason, {
    message: "Choose a lost reason",
    path: ["lost_reason"],
  });

export type LeadStatusChangeInput = z.input<typeof leadStatusChangeSchema>;

export const activitySchema = z.object({
  activity_type: z.enum(values(ACTIVITY_TYPES.filter((a) => a.value !== "status_change"))),
  body: z.string().trim().min(1, "Write something first").max(4000),
});

export type ActivityInput = z.input<typeof activitySchema>;
