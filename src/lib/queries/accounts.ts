import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { daysFromToday } from "@/lib/format";

type Client = SupabaseClient<Database>;

/** Totals per currency, e.g. { USD: 1200, AED: 350 }. Never mixes currencies. */
export type CurrencyTotals = Record<string, number>;

export function sumByCurrency<T extends { currency: string }>(rows: readonly T[] | null | undefined, pick: (row: T) => number | string | null | undefined): CurrencyTotals {
  const out: CurrencyTotals = {};
  (rows ?? []).forEach((r) => {
    const n = Number(pick(r) ?? 0);
    if (!Number.isFinite(n)) return;
    out[r.currency] = Math.round(((out[r.currency] ?? 0) + n) * 100) / 100;
  });
  return out;
}

export function addTotals(...parts: CurrencyTotals[]): CurrencyTotals {
  const out: CurrencyTotals = {};
  parts.forEach((p) => Object.entries(p).forEach(([c, v]) => (out[c] = Math.round(((out[c] ?? 0) + v) * 100) / 100)));
  return out;
}

export function subtractTotals(a: CurrencyTotals, b: CurrencyTotals): CurrencyTotals {
  const out: CurrencyTotals = { ...a };
  Object.entries(b).forEach(([c, v]) => (out[c] = Math.round(((out[c] ?? 0) - v) * 100) / 100));
  return out;
}

export function hasTotals(t: CurrencyTotals): boolean {
  return Object.values(t).some((v) => v !== 0);
}

/** Age bucket for an outstanding item, from its reference date. */
export type AgeBucket = "current" | "1_30" | "31_60" | "over_60";
export const AGE_BUCKETS: { value: AgeBucket; label: string }[] = [
  { value: "current", label: "Not due" },
  { value: "1_30", label: "1–30 days" },
  { value: "31_60", label: "31–60 days" },
  { value: "over_60", label: "Over 60 days" },
];

export function ageBucket(dateISO: string | null | undefined): AgeBucket {
  const days = daysFromToday(dateISO);
  if (days === null || days >= 0) return "current";
  const overdue = -days;
  if (overdue <= 30) return "1_30";
  if (overdue <= 60) return "31_60";
  return "over_60";
}

export type OpenInvoice = {
  id: string;
  invoice_number: string;
  bill_to_name: string;
  issue_date: string;
  due_date_label: string | null;
  currency: string;
  total: number;
  received: number;
  balance: number;
  last_received_on: string | null;
  deal: { id: string; deal_ref: string; title: string; party_name: string } | null;
  age_days: number;
};

/** Issued invoices that still have a balance, with what has been received so far. */
export async function getOpenInvoices(supabase: Client): Promise<OpenInvoice[]> {
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, invoice_number, bill_to_name, issue_date, due_date_label, currency, total, deal:deals(id, deal_ref, title, party:parties(name))")
    .eq("status", "issued")
    .order("issue_date", { ascending: true })
    .limit(1000);
  const rows = invoices ?? [];
  if (rows.length === 0) return [];
  const { data: balances } = await supabase
    .from("invoice_balances")
    .select("invoice_id, received, balance, last_received_on")
    .in(
      "invoice_id",
      rows.map((r) => r.id),
    );
  const byId = new Map((balances ?? []).map((b) => [b.invoice_id, b]));
  return rows
    .map((r) => {
      const b = byId.get(r.id);
      const total = Number(r.total);
      const received = Number(b?.received ?? 0);
      return {
        id: r.id,
        invoice_number: r.invoice_number,
        bill_to_name: r.bill_to_name,
        issue_date: r.issue_date,
        due_date_label: r.due_date_label,
        currency: r.currency,
        total,
        received,
        balance: Math.round((total - received) * 100) / 100,
        last_received_on: b?.last_received_on ?? null,
        deal: r.deal ? { id: r.deal.id, deal_ref: r.deal.deal_ref, title: r.deal.title, party_name: r.deal.party?.name ?? "" } : null,
        age_days: -(daysFromToday(r.issue_date) ?? 0),
      };
    })
    .filter((r) => r.balance > 0);
}

export type DealRow = {
  id: string;
  deal_ref: string;
  title: string;
  status: string;
  currency: string;
  deal_value: number;
  pax_count: number | null;
  start_date: string | null;
  end_date: string | null;
  payment_due_on: string | null;
  party: { id: string; name: string } | null;
  invoiced: number;
  received: number;
  costs: number;
  costs_other_currency: number;
  /** deal value (or invoiced, whichever is higher) minus received */
  outstanding: number;
};

export async function getDeals(supabase: Client, filter?: { status?: string; partyId?: string; q?: string }): Promise<DealRow[]> {
  let query = supabase
    .from("deals")
    .select("id, deal_ref, title, status, currency, deal_value, pax_count, start_date, end_date, payment_due_on, party:parties(id, name)")
    .order("created_at", { ascending: false })
    .limit(500);
  if (filter?.status) query = query.eq("status", filter.status);
  if (filter?.partyId) query = query.eq("party_id", filter.partyId);
  if (filter?.q) {
    const like = `%${filter.q.replace(/[%,]/g, "")}%`;
    query = query.or(`deal_ref.ilike.${like},title.ilike.${like}`);
  }
  const { data } = await query;
  const rows = data ?? [];
  if (rows.length === 0) return [];
  const { data: balances } = await supabase
    .from("deal_balances")
    .select("*")
    .in(
      "deal_id",
      rows.map((r) => r.id),
    );
  const byId = new Map((balances ?? []).map((b) => [b.deal_id, b]));
  return rows.map((r) => {
    const b = byId.get(r.id);
    const value = Number(r.deal_value);
    const invoiced = Number(b?.invoiced ?? 0);
    const received = Number(b?.received ?? 0);
    const expected = Math.max(value, invoiced);
    return {
      id: r.id,
      deal_ref: r.deal_ref,
      title: r.title,
      status: r.status,
      currency: r.currency,
      deal_value: value,
      pax_count: r.pax_count,
      start_date: r.start_date,
      end_date: r.end_date,
      payment_due_on: r.payment_due_on,
      party: r.party,
      invoiced,
      received,
      costs: Number(b?.costs ?? 0),
      costs_other_currency: Number(b?.costs_other_currency ?? 0),
      outstanding: Math.max(0, Math.round((expected - received) * 100) / 100),
    };
  });
}

export type LedgerRow = {
  id: string;
  name: string;
  account_type: string;
  currency: string;
  opening_balance: number;
  is_active: boolean;
  bank_name: string | null;
  account_number: string | null;
  balance: number;
};

export async function getLedgers(supabase: Client, includeInactive = false): Promise<LedgerRow[]> {
  let q = supabase.from("bank_accounts").select("id, name, account_type, currency, opening_balance, is_active, bank_name, account_number").order("name");
  if (!includeInactive) q = q.eq("is_active", true);
  const { data } = await q;
  const rows = data ?? [];
  if (rows.length === 0) return [];
  const { data: balances } = await supabase.from("bank_account_balances").select("*");
  const byId = new Map((balances ?? []).map((b) => [b.bank_account_id, Number(b.balance ?? 0)]));
  return rows.map((r) => ({ ...r, opening_balance: Number(r.opening_balance), balance: byId.get(r.id) ?? Number(r.opening_balance) }));
}

/** Month key "2026-09" for a yyyy-MM-dd string. */
export function monthKey(dateISO: string): string {
  return dateISO.slice(0, 7);
}

export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
