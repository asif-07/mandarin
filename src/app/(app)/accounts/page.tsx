import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Landmark } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Amount, MoneyStat } from "@/components/accounts/money";
import { RecordReceiptButton } from "@/components/accounts/receipt-dialog";
import { NewExpenseButton } from "@/components/accounts/expense-dialog";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { getDeals, getLedgers, getOpenInvoices, monthRange, subtractTotals, sumByCurrency } from "@/lib/queries/accounts";
import { daysFromToday, formatDate, formatMoney, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Accounts" };

export default async function AccountsOverviewPage() {
  await requireAdmin();
  const supabase = await createClient();
  const today = todayISO();
  const month = today.slice(0, 7);
  const { from, to } = monthRange(month);

  const [openInvoices, deals, ledgers, { data: unpaid }, { data: receivedRows }, { data: spentRows }, { data: recentReceipts }, { data: recentExpenses }] = await Promise.all([
    getOpenInvoices(supabase),
    getDeals(supabase, { status: "active" }),
    getLedgers(supabase),
    supabase.from("expenses").select("id, expense_ref, description, amount, currency, due_on, party:parties(name)").eq("status", "unpaid").order("due_on", { ascending: true, nullsFirst: false }).limit(500),
    supabase.from("receipts").select("amount, currency").gte("received_on", from).lte("received_on", to),
    supabase.from("expenses").select("amount, currency").eq("status", "paid").gte("paid_on", from).lte("paid_on", to),
    supabase
      .from("receipts")
      .select("id, receipt_ref, received_on, amount, currency, payer_name, invoice:invoices(invoice_number, bill_to_name), deal:deals(deal_ref, title), party:parties(name)")
      .order("received_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("expenses")
      .select("id, expense_ref, spent_on, amount, currency, description, status, category:expense_categories(name)")
      .order("spent_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const invoiceBalances = sumByCurrency(openInvoices, (i) => i.balance);
  const dealOutstanding = sumByCurrency(deals, (d) => d.outstanding);
  const payables = sumByCurrency(unpaid ?? [], (e) => e.amount);
  const received = sumByCurrency(receivedRows ?? [], (r) => r.amount);
  const spent = sumByCurrency(spentRows ?? [], (e) => e.amount);
  const net = subtractTotals(received, spent);

  const overdueDeals = deals.filter((d) => d.outstanding > 0 && d.payment_due_on && (daysFromToday(d.payment_due_on) ?? 0) < 0);
  const overdueInvoices = openInvoices.filter((i) => i.age_days > 30);
  const overdueExpenses = (unpaid ?? []).filter((e) => e.due_on && (daysFromToday(e.due_on) ?? 0) < 0);
  const cash = sumByCurrency(ledgers, (l) => l.balance);

  return (
    <>
      <PageHeader
        title="Accounts"
        description={`Cash position and what is owed, as of ${formatDate(today)}.`}
        actions={
          <>
            <NewExpenseButton variant="outline" />
            <RecordReceiptButton />
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MoneyStat label="Unpaid invoices" totals={invoiceBalances} hint={`${openInvoices.length} issued invoice${openInvoices.length === 1 ? "" : "s"} with a balance`} tone={Object.keys(invoiceBalances).length ? "negative" : undefined} />
        <MoneyStat label="B2B deals outstanding" totals={dealOutstanding} hint={`${deals.filter((d) => d.outstanding > 0).length} active deal${deals.filter((d) => d.outstanding > 0).length === 1 ? "" : "s"} not fully paid (includes their invoices)`} />
        <MoneyStat label="Payables to suppliers" totals={payables} hint={`${unpaid?.length ?? 0} unpaid expense${unpaid?.length === 1 ? "" : "s"}`} />
        <MoneyStat label="Cash & bank" totals={cash} hint={`${ledgers.length} active ledger${ledgers.length === 1 ? "" : "s"}`} tone="auto" />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <MoneyStat label={`Received in ${formatDate(from).slice(2)}`} totals={received} tone="positive" hint="all receipts this month" />
        <MoneyStat label={`Paid out in ${formatDate(from).slice(2)}`} totals={spent} tone="negative" hint="expenses paid this month" />
        <MoneyStat label="Net this month" totals={net} tone="auto" hint="received minus paid out, cash basis" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Needs attention</span>
              <Link href="/accounts/receivables" className="inline-flex items-center gap-1 text-xs font-medium text-mr-body hover:text-mr-ink">
                Receivables <ArrowRight className="size-3" />
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {overdueDeals.length + overdueInvoices.length + overdueExpenses.length === 0 ? (
              <p className="text-sm text-mr-muted">Nothing overdue. Invoices older than 30 days, deals past their payment date and expenses past their due date show here.</p>
            ) : (
              <ul className="divide-y divide-mr-line">
                {overdueDeals.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 py-2.5 text-sm">
                    <span className="size-2 shrink-0 rounded-full bg-mr-red" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <Link href={`/accounts/deals/${d.id}`} className="block truncate font-medium text-mr-ink hover:underline">
                        {d.deal_ref} · {d.title}
                      </Link>
                      <p className="truncate text-xs text-mr-body">
                        {d.party?.name} · payment was due {formatDate(d.payment_due_on)}
                      </p>
                    </div>
                    <Amount value={d.outstanding} currency={d.currency} className="font-medium" />
                  </li>
                ))}
                {overdueInvoices.map((i) => (
                  <li key={i.id} className="flex items-center gap-3 py-2.5 text-sm">
                    <span className={cn("size-2 shrink-0 rounded-full", i.age_days > 60 ? "bg-mr-red" : "bg-mr-warning")} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <Link href={`/invoices/${i.id}`} className="block truncate font-medium text-mr-ink hover:underline">
                        {i.invoice_number} · {i.bill_to_name}
                      </Link>
                      <p className="truncate text-xs text-mr-body">issued {formatDate(i.issue_date)} · {i.age_days} days ago</p>
                    </div>
                    <Amount value={i.balance} currency={i.currency} className="font-medium" />
                  </li>
                ))}
                {overdueExpenses.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 py-2.5 text-sm">
                    <span className="size-2 shrink-0 rounded-full bg-mr-warning" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <Link href="/accounts/expenses?status=unpaid" className="block truncate font-medium text-mr-ink hover:underline">
                        {e.expense_ref} · {e.description}
                      </Link>
                      <p className="truncate text-xs text-mr-body">
                        {e.party?.name ? `${e.party.name} · ` : ""}to pay, was due {formatDate(e.due_on)}
                      </p>
                    </div>
                    <Amount value={e.amount} currency={e.currency} className="font-medium" signed="out" />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Cash & bank</span>
              <Link href="/accounts/ledgers" className="inline-flex items-center gap-1 text-xs font-medium text-mr-body hover:text-mr-ink">
                Ledgers <ArrowRight className="size-3" />
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ledgers.length === 0 ? (
              <p className="text-sm text-mr-muted">
                No ledgers yet. <Link href="/accounts/ledgers" className="underline">Add your bank accounts, cash box and wallets</Link> so receipts and payments update a running balance.
              </p>
            ) : (
              <ul className="divide-y divide-mr-line">
                {ledgers.map((l) => (
                  <li key={l.id} className="flex items-center gap-3 py-2.5 text-sm">
                    <Landmark className="size-4 shrink-0 text-mr-muted" />
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-medium text-mr-ink">{l.name}</span>
                      {l.bank_name && <span className="ml-2 text-xs text-mr-muted">{l.bank_name}</span>}
                    </span>
                    <span className={cn("tnum font-medium", l.balance < 0 && "text-mr-red")}>{formatMoney(l.balance, l.currency)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Recent money in</span>
              <Link href="/accounts/receipts" className="inline-flex items-center gap-1 text-xs font-medium text-mr-body hover:text-mr-ink">
                All receipts <ArrowRight className="size-3" />
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!recentReceipts || recentReceipts.length === 0 ? (
              <p className="text-sm text-mr-muted">No receipts recorded yet.</p>
            ) : (
              <ul className="divide-y divide-mr-line">
                {recentReceipts.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 py-2.5 text-sm">
                    <span className="tnum w-24 shrink-0 text-xs text-mr-muted">{formatDate(r.received_on)}</span>
                    <span className="min-w-0 flex-1 truncate">
                      {r.invoice ? (
                        <>
                          <span className="font-medium text-mr-ink">{r.invoice.invoice_number}</span> <span className="text-mr-body">{r.invoice.bill_to_name}</span>
                        </>
                      ) : r.deal ? (
                        <>
                          <span className="font-medium text-mr-ink">{r.deal.deal_ref}</span> <span className="text-mr-body">{r.deal.title}</span>
                        </>
                      ) : (
                        <span className="text-mr-body">{r.payer_name || r.party?.name || "Other income"}</span>
                      )}
                    </span>
                    <Amount value={r.amount} currency={r.currency} signed="in" className="font-medium" />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Recent money out</span>
              <Link href="/accounts/expenses" className="inline-flex items-center gap-1 text-xs font-medium text-mr-body hover:text-mr-ink">
                All expenses <ArrowRight className="size-3" />
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!recentExpenses || recentExpenses.length === 0 ? (
              <p className="text-sm text-mr-muted">No expenses recorded yet.</p>
            ) : (
              <ul className="divide-y divide-mr-line">
                {recentExpenses.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 py-2.5 text-sm">
                    <span className="tnum w-24 shrink-0 text-xs text-mr-muted">{formatDate(e.spent_on)}</span>
                    <span className="min-w-0 flex-1 truncate">
                      <span className="text-mr-ink">{e.description}</span>
                      <span className="ml-2 text-xs text-mr-muted">{e.category?.name}</span>
                      {e.status === "unpaid" && <span className="ml-2 rounded-md bg-mr-warning/10 px-1.5 py-0.5 text-[11px] font-medium text-mr-warning">unpaid</span>}
                    </span>
                    <Amount value={e.amount} currency={e.currency} signed="out" className="font-medium" />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="mt-6 text-xs text-mr-muted">
        Totals are shown per currency and never converted. Month figures are cash basis: money actually received and paid.
      </p>
    </>
  );
}
