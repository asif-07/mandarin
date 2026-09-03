import { z } from "zod";
import { CURRENCIES, INVOICE_STATUSES } from "@/lib/constants";

const currencyValues = CURRENCIES.map((c) => c.value) as [string, ...string[]];
const statusValues = INVOICE_STATUSES.map((s) => s.value) as [string, ...string[]];

const optionalText = z
  .string()
  .trim()
  .max(500)
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));

export const invoiceItemSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1, "Title is required").max(200),
  description: optionalText,
  reference: optionalText,
  quantity: z.coerce.number().positive("Qty must be greater than 0").max(99999),
  rate: z.coerce.number().min(0, "Rate cannot be negative").max(99_999_999),
});

export const invoiceSchema = z.object({
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose an issue date"),
  due_date_label: z.string().trim().min(1).max(60).default("On Receipt"),
  currency: z.enum(currencyValues).default("USD"),
  bill_to_name: z.string().trim().min(1, "Customer name is required").max(200),
  bill_to_phone: optionalText,
  bill_to_email: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v ? v : null))
    .refine((v) => !v || z.string().email().safeParse(v).success, "Enter a valid email"),
  bill_to_address: optionalText,
  visa_reference: optionalText,
  tax: z.coerce.number().min(0).max(99_999_999).default(0),
  amount_in_words_override: optionalText,
  terms: z.string().trim().max(2000).optional().nullable().transform((v) => (v ? v : null)),
  status: z.enum(statusValues).default("issued"),
  lead_id: z.string().uuid().optional().nullable().transform((v) => (v ? v : null)),
  customer_id: z.string().uuid().optional().nullable().transform((v) => (v ? v : null)),
  items: z.array(invoiceItemSchema).min(1, "Add at least one line item"),
});

export type InvoiceInput = z.input<typeof invoiceSchema>;
export type InvoiceValues = z.output<typeof invoiceSchema>;
export type InvoiceItemValues = z.output<typeof invoiceItemSchema>;

export function computeTotals(items: { quantity: number; rate: number }[], tax: number) {
  const subtotal = round2(items.reduce((sum, it) => sum + round2(Number(it.quantity) * Number(it.rate)), 0));
  const safeTax = round2(Number.isFinite(tax) ? tax : 0);
  return { subtotal, tax: safeTax, total: round2(subtotal + safeTax) };
}

export function round2(n: number): number {
  return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
}
