import { z } from "zod";
import {
  BANK_ACCOUNT_TYPES,
  CURRENCIES,
  DEAL_STATUSES,
  EXPENSE_STATUSES,
  PARTY_TYPES,
  PAYMENT_METHODS,
} from "@/lib/constants";

const currencyValues = CURRENCIES.map((c) => c.value) as [string, ...string[]];
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date");

const optionalDate = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), "Choose a date");

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

const money = z.coerce.number().positive("Amount must be greater than 0").max(999_999_999);

export const partySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  party_type: z.enum(PARTY_TYPES.map((t) => t.value) as [string, ...string[]]),
  contact_name: optionalText,
  phone: optionalText,
  email: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v ? v : null))
    .refine((v) => !v || z.string().email().safeParse(v).success, "Enter a valid email"),
  address: optionalText,
  country: optionalText,
  default_currency: z.enum(currencyValues).default("USD"),
  payment_terms: optionalText,
  notes: optionalText,
  is_active: z.boolean().default(true),
});
export type PartyInput = z.input<typeof partySchema>;
export type PartyValues = z.output<typeof partySchema>;

export const bankAccountSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  account_type: z.enum(BANK_ACCOUNT_TYPES.map((t) => t.value) as [string, ...string[]]),
  currency: z.enum(currencyValues),
  opening_balance: z.coerce.number().min(-999_999_999).max(999_999_999).default(0),
  opening_date: dateStr,
  bank_name: optionalText,
  account_number: optionalText,
  notes: optionalText,
  is_active: z.boolean().default(true),
});
export type BankAccountInput = z.input<typeof bankAccountSchema>;
export type BankAccountValues = z.output<typeof bankAccountSchema>;

export const dealSchema = z
  .object({
    party_id: z.string().uuid("Choose a partner"),
    title: z.string().trim().min(1, "Title is required").max(200),
    description: optionalText,
    status: z.enum(DEAL_STATUSES.map((s) => s.value) as [string, ...string[]]).default("active"),
    currency: z.enum(currencyValues).default("USD"),
    deal_value: z.coerce.number().min(0, "Cannot be negative").max(999_999_999).default(0),
    pax_count: z.coerce
      .number()
      .int()
      .min(0)
      .max(100_000)
      .optional()
      .nullable()
      .transform((v) => (v === undefined || v === null || Number.isNaN(v) ? null : v)),
    start_date: optionalDate,
    end_date: optionalDate,
    payment_due_on: optionalDate,
    travel_group_id: optionalUuid,
    notes: optionalText,
  })
  .refine((v) => !v.start_date || !v.end_date || v.end_date >= v.start_date, {
    message: "End date must be on or after the start date",
    path: ["end_date"],
  });
export type DealInput = z.input<typeof dealSchema>;
export type DealValues = z.output<typeof dealSchema>;

export const receiptSchema = z.object({
  received_on: dateStr,
  amount: money,
  currency: z.enum(currencyValues),
  /** Amount credited to the linked invoice/deal in ITS currency; required only when currencies differ. */
  applied_amount: z.coerce
    .number()
    .positive("Must be greater than 0")
    .max(999_999_999)
    .optional()
    .nullable()
    .transform((v) => (v === undefined || v === null || Number.isNaN(v) ? null : v)),
  method: z.enum(PAYMENT_METHODS.map((m) => m.value) as [string, ...string[]]).default("bank_transfer"),
  bank_account_id: optionalUuid,
  invoice_id: optionalUuid,
  deal_id: optionalUuid,
  party_id: optionalUuid,
  payer_name: optionalText,
  reference: optionalText,
  notes: optionalText,
});
export type ReceiptInput = z.input<typeof receiptSchema>;
export type ReceiptValues = z.output<typeof receiptSchema>;

export const expenseSchema = z
  .object({
    spent_on: dateStr,
    amount: money,
    currency: z.enum(currencyValues),
    category_id: z.string().uuid("Choose a category"),
    description: z.string().trim().min(1, "Describe the expense").max(500),
    party_id: optionalUuid,
    deal_id: optionalUuid,
    travel_group_id: optionalUuid,
    status: z.enum(EXPENSE_STATUSES.map((s) => s.value) as [string, ...string[]]).default("paid"),
    due_on: optionalDate,
    paid_on: optionalDate,
    method: z
      .enum(PAYMENT_METHODS.map((m) => m.value) as [string, ...string[]])
      .optional()
      .nullable()
      .transform((v) => (v ? v : null)),
    bank_account_id: optionalUuid,
    reference: optionalText,
    notes: optionalText,
  })
  .transform((v) => ({
    ...v,
    // An unpaid expense has no payment details yet.
    paid_on: v.status === "paid" ? (v.paid_on ?? v.spent_on) : null,
    method: v.status === "paid" ? v.method : null,
    bank_account_id: v.status === "paid" ? v.bank_account_id : null,
  }));
export type ExpenseInput = z.input<typeof expenseSchema>;
export type ExpenseValues = z.output<typeof expenseSchema>;

export const transferSchema = z
  .object({
    transferred_on: dateStr,
    from_account_id: z.string().uuid("Choose the source ledger"),
    to_account_id: z.string().uuid("Choose the destination ledger"),
    amount_out: money,
    amount_in: z.coerce
      .number()
      .positive("Must be greater than 0")
      .max(999_999_999)
      .optional()
      .nullable()
      .transform((v) => (v === undefined || v === null || Number.isNaN(v) ? null : v)),
    reference: optionalText,
    notes: optionalText,
  })
  .refine((v) => v.from_account_id !== v.to_account_id, {
    message: "Choose two different ledgers",
    path: ["to_account_id"],
  });
export type TransferInput = z.input<typeof transferSchema>;
export type TransferValues = z.output<typeof transferSchema>;

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
});
