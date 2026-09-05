import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { MoneyStat, Totals } from "@/components/accounts/money";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { addTotals, monthKey, monthRange, shiftMonth, subtractTotals, sumByCurrency, type CurrencyTotals } from "@/lib/queries/accounts";
import { formatDate, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Reports" };

function monthLabel(month: string) {
  return formatDate(`${month}-01`).slice(2);
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const supabase = await createClient();
  const today = todayISO();
  const month = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : today.slice(0, 7);
  const { from, to } = monthRange(month);
  const yearStart = monthRange(shiftMonth(month, -11)).from;

  const [{ data: receipts }, { data: expenses }, { data: invoiced }, { data: receiptHistory }, { data: expenseHistory }] = await Promise.all([
    supabase.from("receipts").select("amount, currency, invoice_id, deal_id").gte("received_on", from).lte("received_on", to),
    supabase.from("expenses").select("amount, currency, category:expense_categories(name)").eq("status", "paid").gte("paid_on", from).lte("paid_on", to),
    supabase.from("invoices").select("total, currency").in("status", ["issued", "paid"]).gte("issue_date", from).lte("issue_date", to),
    supabase.from("receipts").select("received_on, amount, currency").gte("received_on", yearStart).lte("received_on", to).limit(10000),
    supabase.from("expenses").select("paid_on, amount, currency").eq("status", "paid").gte("paid_on", yearStart).lte("paid_on", to).limit(10000),
  ]);

  const income = sumByCurrency(receipts ?? [], (r) => r.amount);
  const spent = sumByCurrency(expenses ?? [], (e) => e.amount);
  const net = subtractTotals(income, spent);

  const incomeBySource = [
    { label: "Invoice payments", totals: sumByCurrency((receipts ?? []).filter((r) => r.invoice_id), (r) => r.amount) },
    { label: "B2B deal payments (not invoiced)", totals: sumByCurrency((receipts ?? []).filter((r) => !r.invoice_id && r.deal_id), (r) => r.amount) },
    { label: "Other income", totals: sumByCurrency((receipts ?? []).filter((r) => !r.invoice_id && !r.deal_id), (r) => r.amount) },
  ];
  const byCategory = new Map<string, CurrencyTotals>();
  (expenses ?? []).forEach((e) => {
    const key = e.category?.name ?? "Uncategorised";
    byCategory.set(key, addTotals(byCategory.get(key) ?? {}, { [e.currency]: Number(e.amount) }));
  });
  const categoryRows = [...byCategory.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  const months = Array.from({ length: 12 }, (_, i) => shiftMonth(month, i - 11));
  const history = months.map((m) => {
    const inc = sumByCurrency((receiptHistory ?? []).filter((r) => monthKey(r.received_on) === m), (r) => r.amount);
    const out = sumByCurrency((expenseHistory ?? []).filter((e) => e.paid_on && monthKey(e.paid_on) === m), (e) => e.amount);
    return { month: m, income: inc, spent: out, net: subtractTotals(inc, out) };
  });

  const exportQs = (type: string) => new URLSearchParams({ type, from, to }).toString();

  return (
    <>
      <PageHeader
        title="Reports"
        description="Cash basis: what was actually received and paid in the month. Per currency, never converted."
        actions={
          <>
            <a href={`/api/accounts/export?${exportQs("receipts")}`} className={buttonVariants({ variant: "outline" })}>
              <Download /> Receipts CSV
            </a>
            <a href={`/api/accounts/export?${exportQs("expenses")}`} className={buttonVariants({ variant: "outline" })}>
              <Download /> Expenses CSV
            </a>
          </>
        }
      />

      <div className="mb-6 flex items-center gap-2">
        <Link href={`/accounts/reports?month=${shiftMonth(month, -1)}`} className={buttonVariants({ variant: "outline", size: "sm" })} aria-label="Previous month">
          <ChevronLeft />
        </Link>
        <span className="min-w-[120px] text-center font-heading text-lg font-semibold text-mr-ink">{monthLabel(month)}</span>
        <Link
          href={`/accounts/reports?month=${shiftMonth(month, 1)}`}
          aria-disabled={month >= today.slice(0, 7)}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), month >= today.slice(0, 7) && "pointer-events-none opacity-50")}
          aria-label="Next month"
        >
          <ChevronRight />
        </Link>
        {month !== today.slice(0, 7) && (
          <Link href="/accounts/reports" className="ml-2 text-sm text-mr-body underline">
            This month
          </Link>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MoneyStat label="Received" totals={income} tone="positive" hint={`${receipts?.length ?? 0} receipt${receipts?.length === 1 ? "" : "s"}`} />
        <MoneyStat label="Paid out" totals={spent} tone="negative" hint={`${expenses?.length ?? 0} paid expense${expenses?.length === 1 ? "" : "s"}`} />
        <MoneyStat label="Net cash" totals={net} tone="auto" hint="received minus paid out" />
        <MoneyStat label="Invoiced" totals={sumByCurrency(invoiced ?? [], (i) => i.total)} hint="issued and paid invoices dated this month (accrual view)" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Income by source</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-mr-line">
              {incomeBySource.map((row) => (
                <li key={row.label} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="text-mr-body">{row.label}</span>
                  <Totals totals={row.totals} className="items-end" />
                </li>
              ))}
              <li className="flex items-center justify-between gap-3 py-2.5 text-sm font-medium">
                <span>Total received</span>
                <Totals totals={income} className="items-end" />
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Expenses by category</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryRows.length === 0 ? (
              <p className="text-sm text-mr-muted">No expenses paid this month.</p>
            ) : (
              <ul className="divide-y divide-mr-line">
                {categoryRows.map(([name, totals]) => (
                  <li key={name} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="text-mr-body">{name}</span>
                    <Totals totals={totals} className="items-end" />
                  </li>
                ))}
                <li className="flex items-center justify-between gap-3 py-2.5 text-sm font-medium">
                  <span>Total paid out</span>
                  <Totals totals={spent} className="items-end" />
                </li>
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Last 12 months</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-mr-line text-left">
                  <th className="micro-label py-2 pr-4 font-medium">Month</th>
                  <th className="micro-label py-2 pr-4 text-right font-medium">Received</th>
                  <th className="micro-label py-2 pr-4 text-right font-medium">Paid out</th>
                  <th className="micro-label py-2 text-right font-medium">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mr-line">
                {history.map((h) => (
                  <tr key={h.month} className={cn(h.month === month && "bg-mr-surface")}>
                    <td className="py-2 pr-4">
                      <Link href={`/accounts/reports?month=${h.month}`} className="hover:underline">
                        {monthLabel(h.month)}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 text-right">
                      <Totals totals={h.income} className="items-end" tone="positive" />
                    </td>
                    <td className="py-2 pr-4 text-right">
                      <Totals totals={h.spent} className="items-end" tone="negative" />
                    </td>
                    <td className="py-2 text-right">
                      <Totals totals={h.net} className="items-end" tone="auto" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
