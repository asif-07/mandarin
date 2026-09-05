"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isAdmin, requireProfile } from "@/lib/auth";
import { errorMessage, fail, ok, type ActionResult } from "@/lib/result";
import {
  bankAccountSchema,
  categorySchema,
  dealSchema,
  expenseSchema,
  partySchema,
  receiptSchema,
  transferSchema,
  type BankAccountInput,
  type DealInput,
  type ExpenseInput,
  type PartyInput,
  type ReceiptInput,
  type TransferInput,
} from "@/lib/validation/accounts";
import { DEAL_STATUSES } from "@/lib/constants";

const NOT_ALLOWED = "Accounts is only available to admin users";

/** Every mutation here: signed in AND admin. RLS enforces the same rule in the database. */
async function admin() {
  const profile = await requireProfile();
  return isAdmin(profile) ? profile : null;
}

function refresh(...extra: string[]) {
  revalidatePath("/accounts", "layout");
  extra.forEach((p) => revalidatePath(p));
}

function fieldErrors(error: z.ZodError) {
  return z.flattenError(error).fieldErrors as Record<string, string[] | undefined>;
}

// ---------------------------------------------------------------------------
// option loaders for dialogs
// ---------------------------------------------------------------------------
export type PartyOption = { id: string; name: string; party_type: string; default_currency: string };
export type BankAccountOption = { id: string; name: string; currency: string; account_type: string };
export type CategoryOption = { id: string; name: string };
export type InvoiceOption = {
  id: string;
  invoice_number: string;
  bill_to_name: string;
  issue_date: string;
  total: number;
  currency: string;
  status: string;
  deal_id: string | null;
  received: number;
  balance: number;
};
export type DealOption = { id: string; deal_ref: string; title: string; currency: string; party_id: string; party_name: string; status: string };

export async function listPartyOptions(kind?: "partner" | "supplier"): Promise<PartyOption[]> {
  if (!(await admin())) return [];
  const supabase = await createClient();
  let q = supabase.from("parties").select("id, name, party_type, default_currency").eq("is_active", true).order("name");
  if (kind === "partner") q = q.in("party_type", ["b2b_partner", "both"]);
  if (kind === "supplier") q = q.in("party_type", ["supplier", "both"]);
  const { data } = await q;
  return data ?? [];
}

export async function listBankAccountOptions(): Promise<BankAccountOption[]> {
  if (!(await admin())) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("bank_accounts").select("id, name, currency, account_type").eq("is_active", true).order("name");
  return data ?? [];
}

export async function listExpenseCategoryOptions(): Promise<CategoryOption[]> {
  if (!(await admin())) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("expense_categories").select("id, name").eq("is_active", true).order("sort_order").order("name");
  return data ?? [];
}

/** Issued invoices (optionally any status) matched by number or name, with what is still owed. */
export async function searchInvoicesForAccounts(query: string, opts?: { openOnly?: boolean; dealId?: string | null }): Promise<InvoiceOption[]> {
  if (!(await admin())) return [];
  const supabase = await createClient();
  const q = query.trim();
  let req = supabase
    .from("invoices")
    .select("id, invoice_number, bill_to_name, issue_date, total, currency, status, deal_id")
    .order("sequence_number", { ascending: false })
    .limit(15);
  req = opts?.openOnly ? req.eq("status", "issued") : req.in("status", ["issued", "paid"]);
  if (opts?.dealId) req = req.is("deal_id", null);
  if (q) {
    const like = `%${q.replace(/[%,]/g, "")}%`;
    req = req.or(`invoice_number.ilike.${like},bill_to_name.ilike.${like}`);
  }
  const { data } = await req;
  const rows = data ?? [];
  if (rows.length === 0) return [];
  const { data: balances } = await supabase
    .from("invoice_balances")
    .select("invoice_id, received, balance")
    .in(
      "invoice_id",
      rows.map((r) => r.id),
    );
  const byId = new Map((balances ?? []).map((b) => [b.invoice_id, b]));
  return rows.map((r) => ({
    ...r,
    total: Number(r.total),
    received: Number(byId.get(r.id)?.received ?? 0),
    balance: Number(byId.get(r.id)?.balance ?? r.total),
  }));
}

export async function searchDealsForAccounts(query: string): Promise<DealOption[]> {
  if (!(await admin())) return [];
  const supabase = await createClient();
  const q = query.trim();
  let req = supabase
    .from("deals")
    .select("id, deal_ref, title, currency, party_id, status, party:parties(name)")
    .in("status", ["draft", "active", "completed"])
    .order("created_at", { ascending: false })
    .limit(15);
  if (q) {
    const like = `%${q.replace(/[%,]/g, "")}%`;
    req = req.or(`deal_ref.ilike.${like},title.ilike.${like}`);
  }
  const { data } = await req;
  return (data ?? []).map((d) => ({
    id: d.id,
    deal_ref: d.deal_ref,
    title: d.title,
    currency: d.currency,
    party_id: d.party_id,
    party_name: d.party?.name ?? "",
    status: d.status,
  }));
}

// ---------------------------------------------------------------------------
// parties
// ---------------------------------------------------------------------------
export async function createParty(input: PartyInput): Promise<ActionResult<{ id: string }>> {
  const profile = await admin();
  if (!profile) return fail(NOT_ALLOWED);
  const parsed = partySchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields", fieldErrors(parsed.error));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("parties")
    .insert({ ...parsed.data, created_by: profile.id })
    .select("id")
    .single();
  if (error || !data) return fail(error?.code === "23505" ? "A party with this name already exists" : errorMessage(error, "Could not create party"));
  refresh();
  return ok({ id: data.id });
}

export async function updateParty(id: string, input: PartyInput): Promise<ActionResult<{ id: string }>> {
  if (!(await admin())) return fail(NOT_ALLOWED);
  const parsed = partySchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields", fieldErrors(parsed.error));
  const supabase = await createClient();
  const { error } = await supabase.from("parties").update(parsed.data).eq("id", id);
  if (error) return fail(error.code === "23505" ? "A party with this name already exists" : errorMessage(error, "Could not update party"));
  refresh();
  return ok({ id });
}

export async function deleteParty(id: string): Promise<ActionResult<{ id: string }>> {
  if (!(await admin())) return fail(NOT_ALLOWED);
  const supabase = await createClient();
  const [{ count: deals }, { count: receipts }, { count: expenses }] = await Promise.all([
    supabase.from("deals").select("id", { count: "exact", head: true }).eq("party_id", id),
    supabase.from("receipts").select("id", { count: "exact", head: true }).eq("party_id", id),
    supabase.from("expenses").select("id", { count: "exact", head: true }).eq("party_id", id),
  ]);
  if ((deals ?? 0) + (receipts ?? 0) + (expenses ?? 0) > 0) {
    return fail("This party has deals, receipts or expenses. Mark it inactive instead of deleting it.");
  }
  const { error } = await supabase.from("parties").delete().eq("id", id);
  if (error) return fail(errorMessage(error, "Could not delete party"));
  refresh();
  return ok({ id });
}

// ---------------------------------------------------------------------------
// bank / cash ledgers
// ---------------------------------------------------------------------------
export async function createBankAccount(input: BankAccountInput): Promise<ActionResult<{ id: string }>> {
  const profile = await admin();
  if (!profile) return fail(NOT_ALLOWED);
  const parsed = bankAccountSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields", fieldErrors(parsed.error));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bank_accounts")
    .insert({ ...parsed.data, created_by: profile.id })
    .select("id")
    .single();
  if (error || !data) return fail(error?.code === "23505" ? "A ledger with this name already exists" : errorMessage(error, "Could not create ledger"));
  refresh();
  return ok({ id: data.id });
}

export async function updateBankAccount(id: string, input: BankAccountInput): Promise<ActionResult<{ id: string }>> {
  if (!(await admin())) return fail(NOT_ALLOWED);
  const parsed = bankAccountSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields", fieldErrors(parsed.error));
  const supabase = await createClient();
  // Currency is fixed once money has moved through the ledger.
  const { data: current } = await supabase.from("bank_accounts").select("currency").eq("id", id).maybeSingle();
  if (current && current.currency !== parsed.data.currency) {
    const [{ count: r }, { count: e }, { count: tf }, { count: tt }] = await Promise.all([
      supabase.from("receipts").select("id", { count: "exact", head: true }).eq("bank_account_id", id),
      supabase.from("expenses").select("id", { count: "exact", head: true }).eq("bank_account_id", id),
      supabase.from("account_transfers").select("id", { count: "exact", head: true }).eq("from_account_id", id),
      supabase.from("account_transfers").select("id", { count: "exact", head: true }).eq("to_account_id", id),
    ]);
    if ((r ?? 0) + (e ?? 0) + (tf ?? 0) + (tt ?? 0) > 0) return fail("This ledger already has transactions, so its currency cannot change");
  }
  const { error } = await supabase.from("bank_accounts").update(parsed.data).eq("id", id);
  if (error) return fail(error.code === "23505" ? "A ledger with this name already exists" : errorMessage(error, "Could not update ledger"));
  refresh();
  return ok({ id });
}

export async function deleteBankAccount(id: string): Promise<ActionResult<{ id: string }>> {
  if (!(await admin())) return fail(NOT_ALLOWED);
  const supabase = await createClient();
  const [{ count: r }, { count: e }, { count: tf }, { count: tt }] = await Promise.all([
    supabase.from("receipts").select("id", { count: "exact", head: true }).eq("bank_account_id", id),
    supabase.from("expenses").select("id", { count: "exact", head: true }).eq("bank_account_id", id),
    supabase.from("account_transfers").select("id", { count: "exact", head: true }).eq("from_account_id", id),
    supabase.from("account_transfers").select("id", { count: "exact", head: true }).eq("to_account_id", id),
  ]);
  if ((r ?? 0) + (e ?? 0) + (tf ?? 0) + (tt ?? 0) > 0) return fail("This ledger has transactions. Mark it inactive instead of deleting it.");
  const { error } = await supabase.from("bank_accounts").delete().eq("id", id);
  if (error) return fail(errorMessage(error, "Could not delete ledger"));
  refresh();
  return ok({ id });
}

// ---------------------------------------------------------------------------
// deals
// ---------------------------------------------------------------------------
export async function createDeal(input: DealInput): Promise<ActionResult<{ id: string; deal_ref: string }>> {
  const profile = await admin();
  if (!profile) return fail(NOT_ALLOWED);
  const parsed = dealSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields", fieldErrors(parsed.error));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deals")
    .insert({ ...parsed.data, deal_ref: "", created_by: profile.id })
    .select("id, deal_ref")
    .single();
  if (error || !data) return fail(errorMessage(error, "Could not create deal"));
  refresh();
  return ok(data);
}

export async function updateDeal(id: string, input: DealInput): Promise<ActionResult<{ id: string }>> {
  if (!(await admin())) return fail(NOT_ALLOWED);
  const parsed = dealSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields", fieldErrors(parsed.error));
  const supabase = await createClient();
  const { data: current } = await supabase.from("deals").select("currency").eq("id", id).maybeSingle();
  if (current && current.currency !== parsed.data.currency) {
    const { count } = await supabase.from("invoices").select("id", { count: "exact", head: true }).eq("deal_id", id);
    if ((count ?? 0) > 0) return fail("Unlink the deal's invoices before changing its currency");
  }
  const { error } = await supabase.from("deals").update(parsed.data).eq("id", id);
  if (error) return fail(errorMessage(error, "Could not update deal"));
  refresh();
  return ok({ id });
}

export async function setDealStatus(id: string, status: string): Promise<ActionResult<{ status: string }>> {
  if (!(await admin())) return fail(NOT_ALLOWED);
  if (!DEAL_STATUSES.some((s) => s.value === status)) return fail("Invalid status");
  const supabase = await createClient();
  const { error } = await supabase.from("deals").update({ status }).eq("id", id);
  if (error) return fail(errorMessage(error, "Could not update status"));
  refresh();
  return ok({ status });
}

export async function deleteDeal(id: string): Promise<ActionResult<{ id: string }>> {
  if (!(await admin())) return fail(NOT_ALLOWED);
  const supabase = await createClient();
  const [{ count: receipts }, { count: expenses }] = await Promise.all([
    supabase.from("receipts").select("id", { count: "exact", head: true }).eq("deal_id", id),
    supabase.from("expenses").select("id", { count: "exact", head: true }).eq("deal_id", id),
  ]);
  if ((receipts ?? 0) + (expenses ?? 0) > 0) return fail("This deal has receipts or expenses. Cancel it instead of deleting it.");
  const unlink = await supabase.from("invoices").update({ deal_id: null }).eq("deal_id", id);
  if (unlink.error) return fail(errorMessage(unlink.error, "Could not unlink invoices"));
  const { error } = await supabase.from("deals").delete().eq("id", id);
  if (error) return fail(errorMessage(error, "Could not delete deal"));
  refresh("/invoices");
  return ok({ id });
}

export async function linkInvoiceToDeal(dealId: string, invoiceId: string): Promise<ActionResult<{ invoice_number: string }>> {
  if (!(await admin())) return fail(NOT_ALLOWED);
  const supabase = await createClient();
  const [{ data: deal }, { data: invoice }] = await Promise.all([
    supabase.from("deals").select("id, currency").eq("id", dealId).maybeSingle(),
    supabase.from("invoices").select("id, invoice_number, currency, deal_id, status").eq("id", invoiceId).maybeSingle(),
  ]);
  if (!deal) return fail("Deal not found");
  if (!invoice) return fail("Invoice not found");
  if (invoice.deal_id && invoice.deal_id !== dealId) return fail(`${invoice.invoice_number} is already linked to another deal`);
  if (invoice.currency !== deal.currency) return fail(`${invoice.invoice_number} is in ${invoice.currency}; this deal is in ${deal.currency}`);
  if (invoice.status === "cancelled") return fail(`${invoice.invoice_number} is cancelled`);
  const { error } = await supabase.from("invoices").update({ deal_id: dealId }).eq("id", invoiceId);
  if (error) return fail(errorMessage(error, "Could not link invoice"));
  // Receipts already recorded on this invoice now count towards the deal.
  await supabase.from("receipts").update({ deal_id: dealId }).eq("invoice_id", invoiceId).is("deal_id", null);
  refresh("/invoices", `/invoices/${invoiceId}`);
  return ok({ invoice_number: invoice.invoice_number });
}

export async function unlinkInvoiceFromDeal(invoiceId: string): Promise<ActionResult<{ id: string }>> {
  if (!(await admin())) return fail(NOT_ALLOWED);
  const supabase = await createClient();
  const { error } = await supabase.from("invoices").update({ deal_id: null }).eq("id", invoiceId);
  if (error) return fail(errorMessage(error, "Could not unlink invoice"));
  refresh("/invoices", `/invoices/${invoiceId}`);
  return ok({ id: invoiceId });
}

// ---------------------------------------------------------------------------
// receipts (money in)
// ---------------------------------------------------------------------------
export async function createReceipt(input: ReceiptInput): Promise<ActionResult<{ id: string; receipt_ref: string }>> {
  const profile = await admin();
  if (!profile) return fail(NOT_ALLOWED);
  const parsed = receiptSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields", fieldErrors(parsed.error));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("receipts")
    .insert({ ...parsed.data, receipt_ref: "", created_by: profile.id })
    .select("id, receipt_ref")
    .single();
  if (error || !data) return fail(errorMessage(error, "Could not record receipt"));
  refresh("/invoices", "/");
  if (parsed.data.invoice_id) revalidatePath(`/invoices/${parsed.data.invoice_id}`);
  return ok(data);
}

export async function updateReceipt(id: string, input: ReceiptInput): Promise<ActionResult<{ id: string }>> {
  if (!(await admin())) return fail(NOT_ALLOWED);
  const parsed = receiptSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields", fieldErrors(parsed.error));
  const supabase = await createClient();
  const { data: before } = await supabase.from("receipts").select("invoice_id").eq("id", id).maybeSingle();
  const { error } = await supabase.from("receipts").update(parsed.data).eq("id", id);
  if (error) return fail(errorMessage(error, "Could not update receipt"));
  refresh("/invoices", "/");
  [before?.invoice_id, parsed.data.invoice_id].forEach((inv) => inv && revalidatePath(`/invoices/${inv}`));
  return ok({ id });
}

export async function deleteReceipt(id: string): Promise<ActionResult<{ id: string }>> {
  if (!(await admin())) return fail(NOT_ALLOWED);
  const supabase = await createClient();
  const { data: before } = await supabase.from("receipts").select("invoice_id").eq("id", id).maybeSingle();
  const { error } = await supabase.from("receipts").delete().eq("id", id);
  if (error) return fail(errorMessage(error, "Could not delete receipt"));
  refresh("/invoices", "/");
  if (before?.invoice_id) revalidatePath(`/invoices/${before.invoice_id}`);
  return ok({ id });
}

// ---------------------------------------------------------------------------
// expenses (money out)
// ---------------------------------------------------------------------------
export async function createExpense(input: ExpenseInput): Promise<ActionResult<{ id: string; expense_ref: string }>> {
  const profile = await admin();
  if (!profile) return fail(NOT_ALLOWED);
  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields", fieldErrors(parsed.error));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expenses")
    .insert({ ...parsed.data, expense_ref: "", created_by: profile.id })
    .select("id, expense_ref")
    .single();
  if (error || !data) return fail(errorMessage(error, "Could not record expense"));
  refresh();
  return ok(data);
}

export async function updateExpense(id: string, input: ExpenseInput): Promise<ActionResult<{ id: string }>> {
  if (!(await admin())) return fail(NOT_ALLOWED);
  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields", fieldErrors(parsed.error));
  const supabase = await createClient();
  const { error } = await supabase.from("expenses").update(parsed.data).eq("id", id);
  if (error) return fail(errorMessage(error, "Could not update expense"));
  refresh();
  return ok({ id });
}

const markPaidSchema = z.object({
  paid_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the payment date"),
  method: z.string().min(1, "Choose how it was paid"),
  bank_account_id: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  reference: z
    .string()
    .trim()
    .max(200)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
});
export type MarkPaidInput = z.input<typeof markPaidSchema>;

export async function markExpensePaid(id: string, input: MarkPaidInput): Promise<ActionResult<{ id: string }>> {
  if (!(await admin())) return fail(NOT_ALLOWED);
  const parsed = markPaidSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields", fieldErrors(parsed.error));
  const supabase = await createClient();
  const { error } = await supabase.from("expenses").update({ status: "paid", ...parsed.data }).eq("id", id);
  if (error) return fail(errorMessage(error, "Could not mark as paid"));
  refresh();
  return ok({ id });
}

export async function markExpenseUnpaid(id: string): Promise<ActionResult<{ id: string }>> {
  if (!(await admin())) return fail(NOT_ALLOWED);
  const supabase = await createClient();
  const { error } = await supabase.from("expenses").update({ status: "unpaid", paid_on: null, method: null, bank_account_id: null }).eq("id", id);
  if (error) return fail(errorMessage(error, "Could not update expense"));
  refresh();
  return ok({ id });
}

export async function deleteExpense(id: string): Promise<ActionResult<{ id: string }>> {
  if (!(await admin())) return fail(NOT_ALLOWED);
  const supabase = await createClient();
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) return fail(errorMessage(error, "Could not delete expense"));
  refresh();
  return ok({ id });
}

// ---------------------------------------------------------------------------
// transfers between ledgers
// ---------------------------------------------------------------------------
export async function createTransfer(input: TransferInput): Promise<ActionResult<{ id: string }>> {
  const profile = await admin();
  if (!profile) return fail(NOT_ALLOWED);
  const parsed = transferSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields", fieldErrors(parsed.error));
  const supabase = await createClient();
  const { data: accounts } = await supabase
    .from("bank_accounts")
    .select("id, currency")
    .in("id", [parsed.data.from_account_id, parsed.data.to_account_id]);
  const from = accounts?.find((a) => a.id === parsed.data.from_account_id);
  const to = accounts?.find((a) => a.id === parsed.data.to_account_id);
  if (!from || !to) return fail("Choose two ledgers");
  const amountIn = parsed.data.amount_in ?? (from.currency === to.currency ? parsed.data.amount_out : null);
  if (amountIn === null) return fail(`Enter the amount received in ${to.currency}`, { amount_in: [`Amount received in ${to.currency}`] });
  const { data, error } = await supabase
    .from("account_transfers")
    .insert({ ...parsed.data, amount_in: amountIn, created_by: profile.id })
    .select("id")
    .single();
  if (error || !data) return fail(errorMessage(error, "Could not record transfer"));
  refresh();
  return ok({ id: data.id });
}

export async function deleteTransfer(id: string): Promise<ActionResult<{ id: string }>> {
  if (!(await admin())) return fail(NOT_ALLOWED);
  const supabase = await createClient();
  const { error } = await supabase.from("account_transfers").delete().eq("id", id);
  if (error) return fail(errorMessage(error, "Could not delete transfer"));
  refresh();
  return ok({ id });
}

// ---------------------------------------------------------------------------
// expense categories
// ---------------------------------------------------------------------------
export async function createExpenseCategory(input: { name: string }): Promise<ActionResult<{ id: string }>> {
  if (!(await admin())) return fail(NOT_ALLOWED);
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields", fieldErrors(parsed.error));
  const supabase = await createClient();
  const { data, error } = await supabase.from("expense_categories").insert({ name: parsed.data.name, sort_order: 500 }).select("id").single();
  if (error || !data) return fail(error?.code === "23505" ? "That category already exists" : errorMessage(error, "Could not add category"));
  refresh();
  return ok({ id: data.id });
}

export async function setExpenseCategoryActive(id: string, active: boolean): Promise<ActionResult<{ id: string }>> {
  if (!(await admin())) return fail(NOT_ALLOWED);
  const supabase = await createClient();
  const { error } = await supabase.from("expense_categories").update({ is_active: active }).eq("id", id);
  if (error) return fail(errorMessage(error, "Could not update category"));
  refresh();
  return ok({ id });
}
