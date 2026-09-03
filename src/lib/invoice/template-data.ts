import type { Tables } from "@/types/database";
import type { InvoiceTemplateData } from "@/lib/pdf/invoice-template";
import { amountInWords } from "@/lib/invoice/amount-in-words";
import { computeTotals, round2, type InvoiceInput } from "@/lib/validation/invoice";
import type { Currency } from "@/lib/constants";

export type InvoiceRow = Tables<"invoices">;
export type InvoiceItemRow = Tables<"invoice_items">;

/** Saved invoice -> template data. */
export function invoiceToTemplateData(invoice: InvoiceRow, items: InvoiceItemRow[]): InvoiceTemplateData {
  return {
    invoice_number: invoice.invoice_number,
    issue_date: invoice.issue_date,
    due_date_label: invoice.due_date_label ?? "On Receipt",
    currency: invoice.currency,
    bill_to_name: invoice.bill_to_name,
    bill_to_phone: invoice.bill_to_phone,
    bill_to_email: invoice.bill_to_email,
    bill_to_address: invoice.bill_to_address,
    items: [...items]
      .sort((a, b) => a.position - b.position)
      .map((it) => ({
        title: it.title,
        description: it.description,
        reference: it.reference,
        quantity: Number(it.quantity),
        rate: Number(it.rate),
        amount: Number(it.amount),
      })),
    subtotal: Number(invoice.subtotal),
    tax: Number(invoice.tax),
    total: Number(invoice.total),
    amount_in_words: invoice.amount_in_words,
    terms: invoice.terms,
  };
}

/** Unsaved form values -> template data, used for the live preview. Tolerates partial input. */
export function formValuesToTemplateData(values: Partial<InvoiceInput>, invoiceNumber: string): InvoiceTemplateData {
  const currency = (values.currency ?? "USD") as Currency;
  const items = (values.items ?? []).map((it) => {
    const quantity = Number(it?.quantity ?? 0) || 0;
    const rate = Number(it?.rate ?? 0) || 0;
    return {
      title: it?.title ?? "",
      description: it?.description ?? null,
      reference: it?.reference ?? null,
      quantity,
      rate,
      amount: round2(quantity * rate),
    };
  });
  const totals = computeTotals(items, Number(values.tax ?? 0) || 0);
  const override = values.amount_in_words_override?.trim();
  return {
    invoice_number: invoiceNumber,
    issue_date: values.issue_date ?? "",
    due_date_label: values.due_date_label || "On Receipt",
    currency,
    bill_to_name: values.bill_to_name ?? "",
    bill_to_phone: values.bill_to_phone ?? null,
    bill_to_email: values.bill_to_email ?? null,
    bill_to_address: values.bill_to_address ?? null,
    items,
    ...totals,
    amount_in_words: override || amountInWords(totals.total, currency),
    terms: values.terms ?? null,
  };
}
