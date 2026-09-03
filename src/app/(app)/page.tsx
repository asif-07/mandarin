import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { addDays, parseISO, subDays } from "date-fns";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusPill, INVOICE_TONES } from "@/components/shared/status-pill";
import { FollowupItem } from "@/components/leads/followup-list";
import { DocsBadge } from "@/components/travel/traveller-table";
import { createClient } from "@/lib/supabase/server";
import { getFollowups } from "@/lib/queries/followups";
import { docCompleteness, groupTitle } from "@/lib/queries/travel";
import { ENQUIRY_TYPES, INVOICE_STATUSES, labelFor } from "@/lib/constants";
import { daysFromToday, formatDate, formatMoney, formatNumber, todayISO, toISODate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const today = todayISO();
  const monthStart = `${today.slice(0, 7)}-01`;
  const monthStartTs = `${monthStart}T00:00:00+04:00`;
  const in7 = toISODate(addDays(parseISO(today), 7));
  const ago90Ts = `${toISODate(subDays(parseISO(today), 90))}T00:00:00+04:00`;

  const [
    { count: leadsThisMonth },
    { data: closed },
    { data: invoicedRows },
    { count: travellersNext7 },
    followups,
    { data: urgentRows },
    { data: recentInvoices },
    { data: leadTypes },
  ] = await Promise.all([
    supabase.from("leads").select("id", { count: "exact", head: true }).gte("created_at", monthStartTs),
    supabase.from("leads").select("status").in("status", ["won", "lost"]).gte("updated_at", ago90Ts),
    supabase.from("invoices").select("total").eq("currency", "USD").in("status", ["issued", "paid"]).gte("issue_date", monthStart),
    supabase
      .from("travellers")
      .select("id", { count: "exact", head: true })
      .gte("travel_start_date", today)
      .lte("travel_start_date", in7)
      .neq("status", "cancelled"),
    getFollowups(supabase, 0),
    supabase
      .from("travellers")
      .select("id, full_name, travel_start_date, status, group:travel_groups(travel_date, group_code, label), traveller_documents(doc_type, deleted_at)")
      .gte("travel_start_date", today)
      .lte("travel_start_date", in7)
      .not("status", "in", "(cancelled,travelled)")
      .order("travel_start_date"),
    supabase
      .from("invoices")
      .select("id, invoice_number, bill_to_name, issue_date, total, currency, status")
      .order("sequence_number", { ascending: false })
      .limit(6),
    supabase.from("leads").select("enquiry_type").gte("created_at", ago90Ts),
  ]);

  const won = (closed ?? []).filter((l) => l.status === "won").length;
  const closedCount = closed?.length ?? 0;
  const conversion = closedCount ? Math.round((won / closedCount) * 100) : null;
  const invoiced = (invoicedRows ?? []).reduce((s, r) => s + Number(r.total), 0);
  const due = [...followups.overdue, ...followups.dueToday];

  const urgent = (urgentRows ?? [])
    .map((t) => ({ ...t, docs: docCompleteness(t.traveller_documents) }))
    .filter((t) => !t.docs.complete);

  const typeCounts = ENQUIRY_TYPES.map((t) => ({
    ...t,
    count: (leadTypes ?? []).filter((l) => l.enquiry_type === t.value).length,
  }));
  const maxCount = Math.max(1, ...typeCounts.map((t) => t.count));

  return (
    <>
      <PageHeader title="Dashboard" description={formatDate(today)} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Leads this month" value={String(leadsThisMonth ?? 0)} hint={`since ${formatDate(monthStart)}`} href="/leads" />
        <Stat
          label="Conversion rate"
          value={conversion === null ? "—" : `${conversion}%`}
          hint={closedCount ? `${won} won of ${closedCount} closed, last 90 days` : "no closed leads in the last 90 days"}
          href="/leads?view=table"
        />
        <Stat label="Invoiced this month" value={`USD ${formatNumber(invoiced)}`} hint="issued and paid, USD invoices" href="/invoices" />
        <Stat label="Travelling in 7 days" value={String(travellersNext7 ?? 0)} hint={`${formatDate(today)} to ${formatDate(in7)}`} href="/travel/travellers" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card className="xl:order-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-mr-red" />
              Incomplete documents, travelling within 7 days
            </CardTitle>
          </CardHeader>
          <CardContent>
            {urgent.length === 0 ? (
              <p className="text-sm text-mr-muted">Every traveller departing this week has all four documents.</p>
            ) : (
              <ul className="divide-y divide-mr-line">
                {urgent.map((t) => {
                  const days = daysFromToday(t.travel_start_date) ?? 0;
                  return (
                    <li key={t.id} className="flex items-center gap-3 py-2.5">
                      <span className={cn("size-2 shrink-0 rounded-full", days <= 2 ? "bg-mr-red" : "bg-mr-warning")} aria-hidden />
                      <div className="min-w-0 flex-1">
                        <Link href={`/travel/travellers/${t.id}`} className="block truncate text-sm font-medium text-mr-ink hover:underline">
                          {t.full_name}
                        </Link>
                        <p className="truncate text-xs text-mr-body">
                          {days === 0 ? "Travels today" : days === 1 ? "Travels tomorrow" : `Travels in ${days} days`} · {formatDate(t.travel_start_date)}
                          {t.group ? ` · ${groupTitle(t.group)}` : ""}
                          {t.docs.missing.length ? ` · missing ${t.docs.missingLabels.join(", ")}` : ""}
                        </p>
                      </div>
                      <DocsBadge count={t.docs.count} total={t.docs.total} />
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="xl:order-2">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Follow-ups due today</span>
              <Link href="/leads/followups" className="inline-flex items-center gap-1 text-xs font-medium text-mr-body hover:text-mr-ink">
                All follow-ups <ArrowRight className="size-3" />
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {due.length === 0 ? (
              <p className="text-sm text-mr-muted">Nothing due today.</p>
            ) : (
              <ul className="divide-y divide-mr-line">
                {due.slice(0, 8).map((l) => (
                  <FollowupItem key={l.id} lead={l} compact />
                ))}
              </ul>
            )}
            {due.length > 8 && (
              <p className="mt-2 text-xs text-mr-muted">
                {due.length - 8} more in <Link href="/leads/followups" className="underline">follow-ups</Link>.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="xl:order-3">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Recent invoices</span>
              <Link href="/invoices" className="inline-flex items-center gap-1 text-xs font-medium text-mr-body hover:text-mr-ink">
                All invoices <ArrowRight className="size-3" />
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!recentInvoices || recentInvoices.length === 0 ? (
              <p className="text-sm text-mr-muted">No invoices yet.</p>
            ) : (
              <ul className="divide-y divide-mr-line">
                {recentInvoices.map((inv) => (
                  <li key={inv.id} className="flex items-center gap-3 py-2.5 text-sm">
                    <Link href={`/invoices/${inv.id}`} className="w-28 shrink-0 font-medium text-mr-ink hover:underline">
                      {inv.invoice_number}
                    </Link>
                    <span className="min-w-0 flex-1 truncate text-mr-body">{inv.bill_to_name}</span>
                    <span className="tnum hidden text-xs text-mr-muted sm:inline">{formatDate(inv.issue_date)}</span>
                    <span className="tnum font-medium">{formatMoney(inv.total, inv.currency)}</span>
                    <StatusPill label={labelFor(INVOICE_STATUSES, inv.status)} tone={INVOICE_TONES[inv.status]} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="xl:order-4">
          <CardHeader>
            <CardTitle>Leads by enquiry type</CardTitle>
            <p className="text-xs text-mr-muted">Leads created in the last 90 days</p>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3" role="list" aria-label="Leads by enquiry type">
              {typeCounts.map((t) => (
                <li key={t.value} className="grid grid-cols-[130px_1fr_32px] items-center gap-3 text-sm" title={`${t.label}: ${t.count}`}>
                  <span className="truncate text-mr-body">{t.short}</span>
                  <span className="h-2.5 overflow-hidden rounded-r-sm bg-mr-surface">
                    <span className="block h-full rounded-r-sm bg-mr-ink" style={{ width: `${(t.count / maxCount) * 100}%` }} />
                  </span>
                  <span className="tnum text-right font-medium text-mr-ink">{t.count}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Stat({ label, value, hint, href }: { label: string; value: string; hint: string; href: string }) {
  return (
    <Link href={href} className="rounded-lg border border-mr-line bg-white p-5 transition-colors hover:border-mr-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mr-ink">
      <p className="micro-label">{label}</p>
      <p className="tnum mt-2 font-heading text-2xl font-semibold text-mr-ink">{value}</p>
      <p className="mt-1 text-xs text-mr-muted">{hint}</p>
    </Link>
  );
}
