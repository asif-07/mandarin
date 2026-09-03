"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { amountInWords } from "@/lib/invoice/amount-in-words";
import { computeTotals, invoiceSchema, round2, type InvoiceInput, type InvoiceValues } from "@/lib/validation/invoice";
import { INVOICE_STATUSES, type Currency } from "@/lib/constants";
import { errorMessage, fail, ok, type ActionResult } from "@/lib/result";
import { todayISO } from "@/lib/format";

function yearOf(dateISO: string): number {
  return Number(dateISO.slice(0, 4)) || new Date().getUTCFullYear();
}

function buildPayload(values: InvoiceValues) {
  const items = values.items.map((it) => ({
    title: it.title,
    description: it.description,
    reference: it.reference,
    quantity: it.quantity,
    rate: it.rate,
    amount: round2(it.quantity * it.rate),
  }));
  const totals = computeTotals(items, values.tax);
  const invoice = {
    issue_date: values.issue_date,
    due_date_label: values.due_date_label,
    currency: values.currency,
    bill_to_name: values.bill_to_name,
    bill_to_phone: values.bill_to_phone,
    bill_to_email: values.bill_to_email,
    bill_to_address: values.bill_to_address,
    visa_reference: values.visa_reference,
    subtotal: totals.subtotal,
    tax: totals.tax,
    total: totals.total,
    amount_in_words: values.amount_in_words_override ?? amountInWords(totals.total, values.currency as Currency),
    terms: values.terms,
    status: values.status,
    lead_id: values.lead_id,
    customer_id: values.customer_id,
  };
  return { invoice, items };
}

/** The number the next invoice will receive (not claimed until save). */
export async function peekNextInvoiceNumber(year = yearOf(todayISO())): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase.from("counters").select("current_value").eq("key", `invoice_${year}`).maybeSingle();
  return `MR-${year}-${(data?.current_value ?? 0) + 1}`;
}

export async function createInvoice(
  input: InvoiceInput,
): Promise<ActionResult<{ id: string; invoice_number: string }>> {
  await requireProfile();
  const parsed = invoiceSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields", z.flattenError(parsed.error).fieldErrors);
  }
  const supabase = await createClient();
  const { invoice, items } = buildPayload(parsed.data);

  const { data: id, error } = await supabase.rpc("create_invoice", {
    p_year: yearOf(parsed.data.issue_date),
    p_invoice: invoice,
    p_items: items,
  });
  if (error || !id) return fail(errorMessage(error, "Could not create invoice"));

  const { data: row } = await supabase.from("invoices").select("invoice_number").eq("id", id).single();
  revalidatePath("/invoices");
  revalidatePath("/");
  return ok({ id, invoice_number: row?.invoice_number ?? "" });
}

export async function updateInvoice(id: string, input: InvoiceInput): Promise<ActionResult<{ id: string }>> {
  await requireProfile();
  const parsed = invoiceSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields", z.flattenError(parsed.error).fieldErrors);
  }
  const supabase = await createClient();
  const { invoice, items } = buildPayload(parsed.data);
  const { error } = await supabase.rpc("update_invoice", { p_id: id, p_invoice: invoice, p_items: items });
  if (error) return fail(errorMessage(error, "Could not update invoice"));

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
  revalidatePath("/");
  return ok({ id });
}

export async function duplicateInvoice(id: string): Promise<ActionResult<{ id: string; invoice_number: string }>> {
  await requireProfile();
  const supabase = await createClient();
  const { data: source, error } = await supabase
    .from("invoices")
    .select("*, invoice_items(*)")
    .eq("id", id)
    .single();
  if (error || !source) return fail("Invoice not found");

  const input: InvoiceInput = {
    issue_date: todayISO(),
    due_date_label: source.due_date_label ?? "On Receipt",
    currency: source.currency,
    bill_to_name: source.bill_to_name,
    bill_to_phone: source.bill_to_phone,
    bill_to_email: source.bill_to_email,
    bill_to_address: source.bill_to_address,
    visa_reference: source.visa_reference,
    tax: Number(source.tax),
    amount_in_words_override: null,
    terms: source.terms,
    status: "draft",
    lead_id: source.lead_id,
    customer_id: source.customer_id,
    items: [...source.invoice_items]
      .sort((a, b) => a.position - b.position)
      .map((it) => ({
        title: it.title,
        description: it.description,
        reference: it.reference,
        quantity: Number(it.quantity),
        rate: Number(it.rate),
      })),
  };
  return createInvoice(input);
}

export async function setInvoiceStatus(id: string, status: string): Promise<ActionResult<{ status: string }>> {
  await requireProfile();
  if (!INVOICE_STATUSES.some((s) => s.value === status)) return fail("Invalid status");
  const supabase = await createClient();
  const { error } = await supabase.from("invoices").update({ status }).eq("id", id);
  if (error) return fail(errorMessage(error, "Could not update status"));
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
  revalidatePath("/");
  return ok({ status });
}

export type LeadSearchResult = {
  id: string;
  lead_ref: string;
  full_name: string;
  phone: string;
  email: string | null;
  country: string | null;
  city: string | null;
  customer_id: string | null;
  enquiry_type: string;
};

/** Server-side lead search for the "Pull from Lead" combobox. */
export async function searchLeadsForInvoice(query: string): Promise<LeadSearchResult[]> {
  await requireProfile();
  const supabase = await createClient();
  const q = query.trim();
  let req = supabase
    .from("leads")
    .select("id, lead_ref, full_name, phone, email, country, city, customer_id, enquiry_type")
    .order("created_at", { ascending: false })
    .limit(10);
  if (q) {
    const like = `%${q.replace(/[%,]/g, "")}%`;
    req = req.or(`full_name.ilike.${like},phone.ilike.${like},lead_ref.ilike.${like}`);
  }
  const { data } = await req;
  return (data ?? []) as LeadSearchResult[];
}
