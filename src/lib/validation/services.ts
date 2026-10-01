import { z } from "zod";
import { CURRENCIES, SERVICE_KINDS, TRANSFER_MODES } from "@/lib/constants";

const currencyValues = CURRENCIES.map((c) => c.value) as [string, ...string[]];
const kindValues = SERVICE_KINDS.map((k) => k.value) as [string, ...string[]];
const modeValues = TRANSFER_MODES.map((m) => m.value) as [string, ...string[]];

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

const optionalMoney = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((v) => (v === "" || v === null || v === undefined ? null : Number(v)))
  .refine((v) => v === null || (Number.isFinite(v) && v >= 0 && v <= 99_999_999), "Enter a valid amount");

const optionalInt = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((v) => (v === "" || v === null || v === undefined ? null : Number(v)))
  .refine((v) => v === null || (Number.isInteger(v) && v > 0 && v <= 9999), "Enter a whole number greater than 0");

/** One entry of the Product / Service master. */
export const serviceSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  kind: z.enum(kindValues).default("general"),
  description: optionalText,
  default_rate: optionalMoney,
  currency: z
    .enum(currencyValues)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  active: z.boolean().default(true),
  sort: z.coerce.number().int().min(0).max(9999).default(100),
});
export type ServiceInput = z.input<typeof serviceSchema>;
export type ServiceValues = z.output<typeof serviceSchema>;

/** A service attached to a group, with the details entered once at group level. */
export const groupServiceSchema = z
  .object({
    id: optionalUuid,
    service_id: optionalUuid,
    service_name: z.string().trim().min(1, "Choose a service").max(120),
    kind: z.enum(kindValues).default("general"),
    from_place: optionalText,
    to_place: optionalText,
    service_date: z
      .string()
      .optional()
      .nullable()
      .transform((v) => (v ? v : null))
      .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), "Choose a date"),
    pax: optionalInt,
    transfer_mode: z
      .enum(modeValues)
      .optional()
      .nullable()
      .transform((v) => (v ? v : null)),
    notes: optionalText,
    quantity: z
      .union([z.number(), z.string(), z.null(), z.undefined()])
      .transform((v) => (v === "" || v === null || v === undefined ? 1 : Number(v)))
      .refine((v) => Number.isFinite(v) && v > 0 && v <= 99999, "Qty must be greater than 0"),
    rate: optionalMoney,
    currency: z
      .enum(currencyValues)
      .optional()
      .nullable()
      .transform((v) => (v ? v : null)),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "airport_transfer") {
      if (!v.from_place) ctx.addIssue({ code: "custom", path: ["from_place"], message: "Where does the transfer start?" });
      if (!v.to_place) ctx.addIssue({ code: "custom", path: ["to_place"], message: "Where does it go?" });
      if (!v.service_date) ctx.addIssue({ code: "custom", path: ["service_date"], message: "Transfer date is required" });
      if (!v.pax) ctx.addIssue({ code: "custom", path: ["pax"], message: "How many pax?" });
      if (!v.transfer_mode) ctx.addIssue({ code: "custom", path: ["transfer_mode"], message: "Choose the transfer mode" });
    }
  });
export type GroupServiceInput = z.input<typeof groupServiceSchema>;
export type GroupServiceValues = z.output<typeof groupServiceSchema>;

export const groupServicesSchema = z.array(groupServiceSchema).max(50);
