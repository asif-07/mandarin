import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusPill } from "@/components/shared/status-pill";
import { Amount, MoneyStat } from "@/components/accounts/money";
import { RecordReceiptButton } from "@/components/accounts/receipt-dialog";
import { SelectParam } from "@/components/shared/url-filters";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { AGE_BUCKETS, ageBucket, getDeals, getOpenInvoices, sumByCurrency, type AgeBucket } from "@/lib/queries/accounts";
import { daysFromToday, formatDate, formatDateRange } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Receivables" };

const BUCKET_TONE: Record<AgeBucket, "neutral" | "warning" | "red"> = { current: "neutral", "1_30": "neutral", "31_60": "warning", over_60: "red" };

/** Invoice age from issue date; "On Receipt" invoices are due the day they are issued. */
function invoiceBucket(issueDate: string): AgeBucket {
  const days = -(daysFromToday(issueDate) ?? 0);
  if (days <= 0) return "current";
  if (days <= 30) return "1_30";
  if (days <= 60) return "31_60";
  return "over_60";
}

export default async function ReceivablesPage({ searchParams }: { searchParams: Promise<{ age?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const supabase = await createClient();
  const [openInvoices, activeDeals] = await Promise.all([getOpenInvoices(supabase), getDeals(supabase, { status: "active" })]);

  const invoices = sp.age ? openInvoices.filter((i) => invoiceBucket(i.issue_date) === sp.age) : openInvoices;
  const deals = activeDeals.filter((d) => d.outstanding > 0).filter((d) => !sp.age || ageBucket(d.payment_due_on) === sp.age);

  const invoiceTotals = sumByCurrency(openInvoices, (i) => i.balance);
  const dealTotals = sumByCurrency(
    activeDeals.filter((d) => d.outstanding > 0),
    (d) => d.outstanding,
  );
  const over60 = sumByCurrency(
    openInvoices.filter((i) => invoiceBucket(i.issue_date) === "over_60"),
    (i) => i.balance,
  );

  return (
    <>
      <PageHeader title="Receivables" description="Money still to come in: unpaid invoices and B2B deals not yet settled." actions={<RecordReceiptButton />} />

      <div className="grid gap-4 sm:grid-cols-3">
        <MoneyStat label="Unpaid invoices" totals={invoiceTotals} hint={`${openInvoices.length} invoice${openInvoices.length === 1 ? "" : "s"}`} />
        <MoneyStat label="Deals outstanding" totals={dealTotals} hint="deal value or invoiced, minus received" />
        <MoneyStat label="Invoices over 60 days" totals={over60} tone={Object.keys(over60).length ? "negative" : undefined} hint="oldest unpaid invoices" />
      </div>

      <Suspense>
        <div className="mt-6 mb-4 flex flex-wrap items-center gap-2">
          <SelectParam name="age" options={AGE_BUCKETS} placeholder="Age" allLabel="All ages" />
        </div>
      </Suspense>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Unpaid invoices</CardTitle>
          </CardHeader>
          <CardContent>
            {invoices.length === 0 ? (
              <p className="text-sm text-mr-muted">{sp.age ? "No invoices in this age band." : "Every issued invoice is paid."}</p>
            ) : (
              <ul className="divide-y divide-mr-line">
                {invoices.map((i) => {
                  const bucket = invoiceBucket(i.issue_date);
                  return (
                    <li key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 text-sm sm:flex-nowrap">
                      <div className="min-w-0 flex-1">
                        <Link href={`/invoices/${i.id}`} className="font-medium text-mr-ink hover:underline">
                          {i.invoice_number}
                        </Link>
                        <span className="ml-2 text-mr-body">{i.bill_to_name}</span>
                        <p className="truncate text-xs text-mr-muted">
                          issued {formatDate(i.issue_date)} · {i.due_date_label ?? "On Receipt"}
                          {i.deal ? ` · ${i.deal.deal_ref} ${i.deal.party_name}` : ""}
                          {i.received > 0 ? ` · received ${i.received.toFixed(2)} of ${i.total.toFixed(2)}` : ""}
                        </p>
                      </div>
                      <StatusPill label={AGE_BUCKETS.find((b) => b.value === bucket)?.label ?? ""} tone={BUCKET_TONE[bucket]} className="hidden sm:inline-flex" />
                      <Amount value={i.balance} currency={i.currency} className={cn("font-medium", bucket === "over_60" && "text-mr-red")} />
                      <RecordReceiptButton
                        size="sm"
                        variant="outline"
                        label="Receive"
                        invoice={{
                          id: i.id,
                          invoice_number: i.invoice_number,
                          bill_to_name: i.bill_to_name,
                          issue_date: i.issue_date,
                          total: i.total,
                          currency: i.currency,
                          status: "issued",
                          deal_id: i.deal?.id ?? null,
                          received: i.received,
                          balance: i.balance,
                        }}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>B2B deals not fully paid</CardTitle>
          </CardHeader>
          <CardContent>
            {deals.length === 0 ? (
              <p className="text-sm text-mr-muted">{sp.age ? "No deals in this age band." : "Every active deal is settled."}</p>
            ) : (
              <ul className="divide-y divide-mr-line">
                {deals.map((d) => {
                  const bucket = ageBucket(d.payment_due_on);
                  return (
                    <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 text-sm sm:flex-nowrap">
                      <div className="min-w-0 flex-1">
                        <Link href={`/accounts/deals/${d.id}`} className="font-medium text-mr-ink hover:underline">
                          {d.deal_ref}
                        </Link>
                        <span className="ml-2 text-mr-body">{d.title}</span>
                        <p className="truncate text-xs text-mr-muted">
                          {d.party?.name}
                          {d.start_date ? ` · ${formatDateRange(d.start_date, d.end_date ?? d.start_date)}` : ""}
                          {d.payment_due_on ? ` · due ${formatDate(d.payment_due_on)}` : " · no due date"}
                          {d.received > 0 ? ` · received ${d.received.toFixed(2)}` : ""}
                        </p>
                      </div>
                      {d.payment_due_on && <StatusPill label={AGE_BUCKETS.find((b) => b.value === bucket)?.label ?? ""} tone={BUCKET_TONE[bucket]} className="hidden sm:inline-flex" />}
                      <Amount value={d.outstanding} currency={d.currency} className={cn("font-medium", bucket === "over_60" && "text-mr-red")} />
                      <RecordReceiptButton
                        size="sm"
                        variant="outline"
                        label="Receive"
                        deal={{ id: d.id, deal_ref: d.deal_ref, title: d.title, currency: d.currency, party_id: d.party?.id ?? "", party_name: d.party?.name ?? "", status: d.status }}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
      <p className="mt-4 text-xs text-mr-muted">A deal&rsquo;s outstanding amount already includes its linked invoices, so the two lists overlap when a deal has been invoiced.</p>
    </>
  );
}
