import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { Attribution } from "@/components/shell/attribution";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusPill, DEAL_TONES, EXPENSE_TONES, INVOICE_TONES } from "@/components/shared/status-pill";
import { Amount, MoneyStat } from "@/components/accounts/money";
import { DealActions, LinkInvoiceButton, UnlinkInvoiceButton, type DealRecord } from "@/components/accounts/deal-dialog";
import { ReceiptActions, RecordReceiptButton, type ReceiptRecord } from "@/components/accounts/receipt-dialog";
import { ExpenseActions, NewExpenseButton, type ExpenseRecord } from "@/components/accounts/expense-dialog";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { groupTitle } from "@/lib/queries/travel";
import { DEAL_STATUSES, EXPENSE_STATUSES, INVOICE_STATUSES, PAYMENT_METHODS, labelFor } from "@/lib/constants";
import { formatDate, formatDateRange } from "@/lib/format";
import type { GroupOption } from "@/lib/actions/travel-groups";

export const metadata: Metadata = { title: "Deal" };

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();

  const { data: deal } = await supabase
    .from("deals")
    .select(
      "*, party:parties(id, name, party_type, default_currency, payment_terms), group:travel_groups(id, travel_date, travel_end_date, group_code, label, guide_name, reference_prefix, travellers(count)), creator:profiles!deals_created_by_fkey(display_name)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!deal) notFound();

  const [{ data: balanceRow }, { data: invoices }, { data: receipts }, { data: expenses }] = await Promise.all([
    supabase.from("deal_balances").select("*").eq("deal_id", id).maybeSingle(),
    supabase.from("invoices").select("id, invoice_number, bill_to_name, issue_date, total, currency, status").eq("deal_id", id).order("sequence_number", { ascending: false }),
    supabase
      .from("receipts")
      .select("*, invoice:invoices(id, invoice_number, bill_to_name, issue_date, total, currency, status, deal_id), party:parties(name), ledger:bank_accounts(name)")
      .eq("deal_id", id)
      .order("received_on", { ascending: false }),
    supabase
      .from("expenses")
      .select("*, category:expense_categories(name), party:parties(name), group:travel_groups(id, travel_date, travel_end_date, group_code, label, guide_name, reference_prefix, travellers(count))")
      .eq("deal_id", id)
      .order("spent_on", { ascending: false }),
  ]);

  const { data: invoiceBalances } = invoices && invoices.length
    ? await supabase.from("invoice_balances").select("invoice_id, received, balance").in("invoice_id", invoices.map((i) => i.id))
    : { data: [] as { invoice_id: string | null; received: number | null; balance: number | null }[] };
  const balById = new Map((invoiceBalances ?? []).map((b) => [b.invoice_id, b]));

  const group: GroupOption | null = deal.group
    ? {
        id: deal.group.id,
        travel_date: deal.group.travel_date,
        travel_end_date: deal.group.travel_end_date,
        group_code: deal.group.group_code,
        label: deal.group.label,
        guide_name: deal.group.guide_name,
        reference_prefix: deal.group.reference_prefix,
        traveller_count: Array.isArray(deal.group.travellers) ? Number(deal.group.travellers[0]?.count ?? 0) : 0,
      }
    : null;

  const record: DealRecord & { id: string; deal_ref: string } = {
    id: deal.id,
    deal_ref: deal.deal_ref,
    party_id: deal.party_id,
    title: deal.title,
    description: deal.description ?? "",
    status: deal.status,
    currency: deal.currency,
    deal_value: String(deal.deal_value),
    pax_count: deal.pax_count === null ? "" : String(deal.pax_count),
    start_date: deal.start_date,
    end_date: deal.end_date,
    payment_due_on: deal.payment_due_on,
    travel_group_id: deal.travel_group_id,
    group,
    notes: deal.notes ?? "",
  };
  const dealOption = { id: deal.id, deal_ref: deal.deal_ref, title: deal.title, currency: deal.currency, party_id: deal.party_id, party_name: deal.party?.name ?? "", status: deal.status };
  const balance = {
    invoiced: Number(balanceRow?.invoiced ?? 0),
    received: Number(balanceRow?.received ?? 0),
    costs: Number(balanceRow?.costs ?? 0),
    costs_other_currency: Number(balanceRow?.costs_other_currency ?? 0),
    outstanding: 0,
  };
  balance.outstanding = Math.max(0, Math.round((Math.max(Number(deal.deal_value), balance.invoiced) - balance.received) * 100) / 100);
  const margin = Math.round((balance.received - balance.costs) * 100) / 100;

  return (
    <>
      <PageHeader
        title={`${deal.deal_ref} · ${deal.title}`}
        description={`${deal.party?.name ?? ""}${deal.start_date ? ` · ${formatDateRange(deal.start_date, deal.end_date ?? deal.start_date)}` : ""}${deal.pax_count ? ` · ${deal.pax_count} pax` : ""}`}
        actions={
          <>
            <NewExpenseButton variant="outline" deal={dealOption} partyId={null} label="Add cost" />
            <RecordReceiptButton deal={dealOption} />
            <span className="flex items-center gap-2">
              <StatusPill label={labelFor(DEAL_STATUSES, deal.status)} tone={DEAL_TONES[deal.status]} />
              <DealActions deal={record} />
            </span>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MoneyStat label="Deal value" totals={{ [deal.currency]: Number(deal.deal_value) }} empty={`${deal.currency} 0.00`} />
        <MoneyStat label="Invoiced" totals={{ [deal.currency]: balance?.invoiced ?? 0 }} empty={`${deal.currency} 0.00`} hint={`${invoices?.length ?? 0} linked invoice${invoices?.length === 1 ? "" : "s"}`} />
        <MoneyStat label="Received" totals={{ [deal.currency]: balance?.received ?? 0 }} empty={`${deal.currency} 0.00`} tone="positive" />
        <MoneyStat label="Outstanding" totals={{ [deal.currency]: balance?.outstanding ?? 0 }} empty={`${deal.currency} 0.00`} tone={balance?.outstanding ? "negative" : undefined} hint={deal.payment_due_on ? `due ${formatDate(deal.payment_due_on)}` : "no due date set"} />
        <MoneyStat label="Costs · margin" totals={{ [deal.currency]: balance?.costs ?? 0 }} empty={`${deal.currency} 0.00`} hint={`received − costs: ${deal.currency} ${margin.toFixed(2)}${balance?.costs_other_currency ? ` (+${balance.costs_other_currency} costs in other currencies)` : ""}`} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Invoices</span>
                <LinkInvoiceButton dealId={deal.id} currency={deal.currency} />
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!invoices || invoices.length === 0 ? (
                <p className="text-sm text-mr-muted">
                  No invoices linked. <Link href="/invoices/new" className="underline">Create one</Link> in Invoices, then link it here.
                </p>
              ) : (
                <ul className="divide-y divide-mr-line">
                  {invoices.map((i) => {
                    const b = balById.get(i.id);
                    return (
                      <li key={i.id} className="flex items-center gap-3 py-2.5 text-sm">
                        <Link href={`/invoices/${i.id}`} className="w-28 shrink-0 font-medium text-mr-ink hover:underline">
                          {i.invoice_number}
                        </Link>
                        <span className="min-w-0 flex-1 truncate text-mr-body">
                          {i.bill_to_name} <span className="text-xs text-mr-muted">· {formatDate(i.issue_date)}</span>
                        </span>
                        <span className="tnum text-xs text-mr-muted">{i.status === "issued" && b ? `${Number(b.balance).toFixed(2)} due` : ""}</span>
                        <Amount value={i.total} currency={i.currency} className="font-medium" />
                        <StatusPill label={labelFor(INVOICE_STATUSES, i.status)} tone={INVOICE_TONES[i.status]} />
                        <UnlinkInvoiceButton invoiceId={i.id} invoiceNumber={i.invoice_number} />
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Money received</span>
                <RecordReceiptButton size="sm" variant="outline" deal={dealOption} />
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!receipts || receipts.length === 0 ? (
                <p className="text-sm text-mr-muted">Nothing received yet.</p>
              ) : (
                <ul className="divide-y divide-mr-line">
                  {receipts.map((r) => {
                    const rec: ReceiptRecord & { id: string; receipt_ref: string } = {
                      id: r.id,
                      receipt_ref: r.receipt_ref,
                      received_on: r.received_on,
                      amount: String(r.amount),
                      currency: r.currency,
                      applied_amount: r.applied_amount === null ? "" : String(r.applied_amount),
                      method: r.method,
                      bank_account_id: r.bank_account_id,
                      invoice: r.invoice ? { ...r.invoice, total: Number(r.invoice.total), received: 0, balance: 0 } : null,
                      deal: dealOption,
                      party_id: r.party_id,
                      payer_name: r.payer_name ?? "",
                      reference: r.reference ?? "",
                      notes: r.notes ?? "",
                    };
                    return (
                      <li key={r.id} className="flex items-center gap-3 py-2.5 text-sm">
                        <span className="tnum w-24 shrink-0 text-xs text-mr-muted">{formatDate(r.received_on)}</span>
                        <span className="min-w-0 flex-1 truncate">
                          <span className="font-medium text-mr-ink">{r.receipt_ref}</span>
                          <span className="ml-2 text-mr-body">
                            {labelFor(PAYMENT_METHODS, r.method)}
                            {r.invoice ? ` · ${r.invoice.invoice_number}` : ""}
                            {r.ledger?.name ? ` · ${r.ledger.name}` : ""}
                            {r.reference ? ` · ${r.reference}` : ""}
                          </span>
                        </span>
                        <Amount value={r.amount} currency={r.currency} signed="in" className="font-medium" />
                        {r.currency !== deal.currency && r.applied_amount !== null && <span className="tnum text-xs text-mr-muted">= {deal.currency} {Number(r.applied_amount).toFixed(2)}</span>}
                        <ReceiptActions receipt={rec} />
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Costs</span>
                <NewExpenseButton size="sm" variant="outline" deal={dealOption} label="Add cost" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!expenses || expenses.length === 0 ? (
                <p className="text-sm text-mr-muted">No costs recorded against this deal.</p>
              ) : (
                <ul className="divide-y divide-mr-line">
                  {expenses.map((e) => {
                    const g: GroupOption | null = e.group
                      ? {
                          id: e.group.id,
                          travel_date: e.group.travel_date,
                          travel_end_date: e.group.travel_end_date,
                          group_code: e.group.group_code,
                          label: e.group.label,
                          guide_name: e.group.guide_name,
                          reference_prefix: e.group.reference_prefix,
                          traveller_count: Array.isArray(e.group.travellers) ? Number(e.group.travellers[0]?.count ?? 0) : 0,
                        }
                      : null;
                    const rec: ExpenseRecord & { id: string; expense_ref: string } = {
                      id: e.id,
                      expense_ref: e.expense_ref,
                      spent_on: e.spent_on,
                      amount: String(e.amount),
                      currency: e.currency,
                      category_id: e.category_id,
                      description: e.description,
                      party_id: e.party_id,
                      deal: dealOption,
                      travel_group_id: e.travel_group_id,
                      group: g,
                      status: e.status,
                      due_on: e.due_on,
                      paid_on: e.paid_on,
                      method: e.method ?? "bank_transfer",
                      bank_account_id: e.bank_account_id,
                      reference: e.reference ?? "",
                      notes: e.notes ?? "",
                    };
                    return (
                      <li key={e.id} className="flex items-center gap-3 py-2.5 text-sm">
                        <span className="tnum w-24 shrink-0 text-xs text-mr-muted">{formatDate(e.spent_on)}</span>
                        <span className="min-w-0 flex-1 truncate">
                          <span className="text-mr-ink">{e.description}</span>
                          <span className="ml-2 text-xs text-mr-muted">
                            {e.category?.name}
                            {e.party?.name ? ` · ${e.party.name}` : ""}
                          </span>
                        </span>
                        <StatusPill label={labelFor(EXPENSE_STATUSES, e.status)} tone={EXPENSE_TONES[e.status]} className="hidden sm:inline-flex" />
                        <Amount value={e.amount} currency={e.currency} signed="out" className="font-medium" />
                        <ExpenseActions expense={rec} />
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Partner</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {deal.party ? (
                <>
                  <Link href={`/accounts/parties/${deal.party.id}`} className="font-medium text-mr-ink hover:underline">
                    {deal.party.name}
                  </Link>
                  {deal.party.payment_terms && <p className="text-mr-body">{deal.party.payment_terms}</p>}
                </>
              ) : (
                <p className="text-mr-muted">No partner.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {deal.description && <p className="whitespace-pre-wrap text-mr-body">{deal.description}</p>}
              <dl className="grid grid-cols-[110px_1fr] gap-y-2">
                <dt className="text-mr-muted">Travel</dt>
                <dd>{deal.start_date ? formatDateRange(deal.start_date, deal.end_date ?? deal.start_date) : "—"}</dd>
                <dt className="text-mr-muted">Pax</dt>
                <dd>{deal.pax_count ?? "—"}</dd>
                <dt className="text-mr-muted">Payment due</dt>
                <dd>{deal.payment_due_on ? formatDate(deal.payment_due_on) : "—"}</dd>
                <dt className="text-mr-muted">Travel group</dt>
                <dd>
                  {deal.group ? (
                    <Link href={`/travel?date=${deal.group.travel_date}`} className="hover:underline">
                      {groupTitle(deal.group)}
                    </Link>
                  ) : (
                    "—"
                  )}
                </dd>
              </dl>
              {deal.notes && <p className="whitespace-pre-wrap border-t border-mr-line pt-3 text-mr-body">{deal.notes}</p>}
              <div className="border-t border-mr-line pt-3">
                <Attribution name={deal.creator?.display_name} date={deal.created_at} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
