import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Download, Plane, Users } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { addDays, parseISO } from "date-fns";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusPill, INVOICE_TONES, TRAVELLER_TONES } from "@/components/shared/status-pill";
import { DocsBadge, PackageBadge } from "@/components/travel/traveller-table";
import { createClient } from "@/lib/supabase/server";
import { docCompleteness, groupTitle } from "@/lib/queries/travel";
import { CompileGroupButton } from "@/components/travel/pack-panel";
import { VisaStatusPill } from "@/components/travel/group-visa";
import { INVOICE_STATUSES, TRAVELLER_STATUSES, labelFor, packageDetail } from "@/lib/constants";
import { daysFromToday, formatDate, formatDateRange, formatMoney, formatNumber, todayISO, toISODate } from "@/lib/format";
import { endOfMonth, format as formatDf } from "date-fns";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const today = todayISO();
  const monthStart = `${today.slice(0, 7)}-01`;
  const in7 = toISODate(addDays(parseISO(today), 7));
  const monthEnd = toISODate(endOfMonth(parseISO(today)));
  const monthLabel = formatDf(parseISO(today), "MMMM yyyy");

  const [
    { data: monthTravellers },
    { count: groupsThisMonth },
    { data: invoicedRows },
    { count: travellersNext7 },
    { data: urgentRows },
    { data: recentInvoices },
    { data: groupRows },
  ] = await Promise.all([
    supabase
      .from("travellers")
      .select("id, traveller_ref, full_name, phone, nationality, passport_number, travel_start_date, travel_end_date, status, package_tier, hotel_name, hotel_stars, group:travel_groups(id, travel_date, travel_end_date, group_code, label, group_documents(doc_type, deleted_at)), traveller_documents(doc_type, deleted_at)")
      .gte("travel_start_date", monthStart)
      .lte("travel_start_date", monthEnd)
      .neq("status", "cancelled")
      .order("travel_start_date")
      .order("full_name")
      .limit(300),
    supabase.from("travel_groups").select("id", { count: "exact", head: true }).gte("travel_date", monthStart).lte("travel_date", monthEnd),
    supabase.from("invoices").select("total").eq("currency", "USD").in("status", ["issued", "paid"]).gte("issue_date", monthStart),
    supabase
      .from("travellers")
      .select("id", { count: "exact", head: true })
      .gte("travel_start_date", today)
      .lte("travel_start_date", in7)
      .neq("status", "cancelled"),
    supabase
      .from("travellers")
      .select("id, full_name, travel_start_date, status, group:travel_groups(travel_date, group_code, label, group_documents(doc_type, deleted_at)), traveller_documents(doc_type, deleted_at)")
      .gte("travel_start_date", today)
      .lte("travel_start_date", in7)
      .not("status", "in", "(cancelled,travelled)")
      .order("travel_start_date"),
    supabase
      .from("invoices")
      .select("id, invoice_number, bill_to_name, issue_date, total, currency, status")
      .order("sequence_number", { ascending: false })
      .limit(6),
    supabase
      .from("travel_groups")
      .select("id, travel_date, travel_end_date, group_code, label, guide_name, entry_port, exit_port, source, partner_code, pax_expected, pack_path, visa_status, visa_applied_at, visa_uploaded_at, group_documents(doc_type, deleted_at), travellers(id, status, traveller_documents(doc_type, deleted_at))")
      .gte("travel_end_date", today)
      .order("travel_date", { ascending: true })
      .order("group_code", { ascending: true })
      .limit(9),
  ]);

  const upcomingGroups = (groupRows ?? []).map((g) => {
    const active = g.travellers.filter((t) => t.status !== "cancelled");
    const complete = active.filter((t) => docCompleteness(t.traveller_documents, g.group_documents).complete).length;
    const days = daysFromToday(g.travel_date) ?? 0;
    const b2b = g.source === "b2b";
    return { ...g, b2b, pax: b2b && g.pax_expected ? g.pax_expected : active.length, complete, days, travelling: days <= 0 };
  });

  const invoiced = (invoicedRows ?? []).reduce((s, r) => s + Number(r.total), 0);
  const travellersThisMonth = (monthTravellers ?? []).map((t) => ({ ...t, docs: docCompleteness(t.traveller_documents, t.group?.group_documents), days: daysFromToday(t.travel_start_date) ?? 0 }));
  const monthComplete = travellersThisMonth.filter((t) => t.docs.complete).length;
  const monthTravelledOrTravelling = travellersThisMonth.filter((t) => t.days <= 0).length;

  const urgent = (urgentRows ?? [])
    .map((t) => ({ ...t, docs: docCompleteness(t.traveller_documents, t.group?.group_documents) }))
    .filter((t) => !t.docs.complete);

  return (
    <>
      <PageHeader title="Dashboard" description={formatDate(today)} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Travellers this month"
          value={String(travellersThisMonth.length)}
          hint={`${monthLabel} · ${monthTravelledOrTravelling} already departed · ${monthComplete} with all documents`}
          href="/travel/travellers"
        />
        <Stat label="Travelling in 7 days" value={String(travellersNext7 ?? 0)} hint={`${formatDate(today)} to ${formatDate(in7)}`} href="/travel/travellers" />
        <Stat label="Groups this month" value={String(groupsThisMonth ?? 0)} hint={`departing in ${monthLabel}`} href="/travel/groups" />
        <Stat label="Invoiced this month" value={`USD ${formatNumber(invoiced)}`} hint="issued and paid, USD invoices" href="/invoices" />
      </div>

      <section className="mt-6" aria-labelledby="upcoming-groups">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="upcoming-groups" className="flex items-center gap-2 text-base font-semibold text-mr-ink">
            <Plane className="size-4 text-mr-red" /> Travelling groups
          </h2>
          <Link href="/travel" className="inline-flex items-center gap-1 text-xs font-medium text-mr-body hover:text-mr-ink">
            All groups <ArrowRight className="size-3" />
          </Link>
        </div>
        {upcomingGroups.length === 0 ? (
          <p className="rounded-lg border border-dashed border-mr-line px-4 py-6 text-center text-sm text-mr-muted">
            No groups travelling today or later. <Link href="/travel/groups" className="underline">Create groups</Link> to see them here.
          </p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {upcomingGroups.map((g) => (
              <li key={g.id} className={cn("rounded-lg border bg-white p-5", g.travelling ? "border-mr-ink" : "border-mr-line")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="tnum text-sm font-medium text-mr-body">{formatDateRange(g.travel_date, g.travel_end_date)}</p>
                    <Link href={`/travel?date=${g.travel_date}`} className="mt-0.5 block truncate font-heading text-xl font-semibold text-mr-ink hover:underline">
                      {g.group_code}
                      {g.b2b && <span className="ml-2 align-middle rounded-md bg-mr-ink px-1.5 py-0.5 font-sans text-[11px] font-medium text-white">B2B {g.partner_code}</span>}
                      {g.label ? <span className="font-sans text-base font-normal text-mr-body"> · {g.label}</span> : null}
                    </Link>
                  </div>
                  <span className={cn("shrink-0 rounded-md px-2 py-1 text-xs font-medium", g.travelling ? "bg-mr-ink text-white" : g.days <= 7 ? "bg-mr-warning/10 text-mr-warning" : "bg-mr-surface text-mr-body")}>
                    {g.travelling ? "Travelling now" : g.days === 1 ? "Tomorrow" : `In ${g.days} days`}
                  </span>
                </div>
                <div className="mt-4 flex items-end justify-between gap-3">
                  <div>
                    <p className="micro-label">Travellers</p>
                    <p className="tnum mt-1 font-heading text-3xl font-semibold leading-none text-mr-ink">{g.pax}</p>
                  </div>
                  {!g.b2b && (
                    <div className="text-right">
                      <p className="micro-label">Documents complete</p>
                      <div className="mt-1 flex justify-end">
                        <DocsBadge count={g.complete} total={g.pax} />
                      </div>
                    </div>
                  )}
                  {g.b2b && (
                    <div className="text-right">
                      <p className="micro-label">Pack</p>
                      <p className="mt-1 text-xs text-mr-body">{g.pack_path ? "Partner PDF filed" : "Not uploaded"}</p>
                    </div>
                  )}
                </div>
                <p className="mt-4 truncate border-t border-mr-line pt-3 text-xs text-mr-muted">
                  {g.entry_port && g.exit_port ? `In: ${g.entry_port} · Out: ${g.exit_port}` : <span className="text-mr-warning">Entry / exit port missing</span>}
                  {g.guide_name ? ` · Guide: ${g.guide_name}` : ""}
                </p>
                <div className="mt-2">
                  <VisaStatusPill group={g} />
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <Link href={`/travel?date=${g.travel_date}`} className="text-xs font-medium text-mr-body hover:text-mr-ink hover:underline">
                    Open group
                  </Link>
                  {g.b2b ? (
                    g.pack_path ? (
                      <a href={`/api/groups/${g.id}/b2b-pack`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                        <Download /> Partner pack
                      </a>
                    ) : null
                  ) : (
                    <CompileGroupButton groupId={g.id} travellerCount={g.pax} />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

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

        <Card className="xl:order-2 xl:row-span-2">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Users className="size-4 text-mr-red" /> Traveller details, {monthLabel}
              </span>
              <Link href="/travel/travellers" className="inline-flex items-center gap-1 text-xs font-medium text-mr-body hover:text-mr-ink">
                All travellers <ArrowRight className="size-3" />
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {travellersThisMonth.length === 0 ? (
              <p className="text-sm text-mr-muted">No travellers departing in {monthLabel}.</p>
            ) : (
              <ul className="divide-y divide-mr-line">
                {travellersThisMonth.slice(0, 40).map((t) => (
                  <li key={t.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <Link href={`/travel/travellers/${t.id}`} className="block truncate text-sm font-medium text-mr-ink hover:underline">
                        {t.full_name} <span className="font-mono text-xs font-normal text-mr-muted">{t.traveller_ref}</span>
                      </Link>
                      <p className="truncate text-xs text-mr-body">
                        {formatDateRange(t.travel_start_date, t.travel_end_date)}
                        {t.group ? ` · ${groupTitle(t.group)}` : " · no group"}
                        {t.passport_number ? ` · ${t.passport_number}` : ""}
                        {t.nationality ? ` · ${t.nationality}` : ""}
                        {t.package_tier ? ` · ${packageDetail(t.package_tier, t.hotel_stars, t.hotel_name)}` : ""}
                      </p>
                    </div>
                    <PackageBadge tier={t.package_tier} />
                    <StatusPill label={labelFor(TRAVELLER_STATUSES, t.status)} tone={TRAVELLER_TONES[t.status]} className="hidden sm:inline-flex" />
                    <DocsBadge count={t.docs.count} total={t.docs.total} />
                  </li>
                ))}
              </ul>
            )}
            {travellersThisMonth.length > 40 && (
              <p className="mt-2 text-xs text-mr-muted">
                {travellersThisMonth.length - 40} more in <Link href="/travel/travellers" className="underline">travellers</Link>.
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
