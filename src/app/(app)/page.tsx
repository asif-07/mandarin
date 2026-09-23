import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, Plane, Users } from "lucide-react";
import { StatCard, StatGrid } from "@/components/shared/stat-card";
import { Section } from "@/components/shared/section";
import { Chip } from "@/components/shared/chip";
import { addDays, parseISO, subDays } from "date-fns";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusPill, TRAVELLER_TONES } from "@/components/shared/status-pill";
import { DocsBadge, PackageBadge } from "@/components/travel/traveller-table";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isAdmin } from "@/lib/auth";
import { RecordReceiptButton } from "@/components/accounts/receipt-dialog";
import { MarkPaidButton } from "@/components/invoices/mark-paid-button";
import { docCompleteness, groupTitle } from "@/lib/queries/travel";
import { CompileGroupButton } from "@/components/travel/pack-panel";
import { DownloadBundleButton, VisaStatusPill } from "@/components/travel/group-visa";
import { TRAVELLER_STATUSES, labelFor, packageDetail } from "@/lib/constants";
import { daysFromToday, formatDate, formatDateRange, formatMoney, formatNumber, todayISO, toISODate } from "@/lib/format";
import { endOfMonth, format as formatDf } from "date-fns";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const current = await getCurrentProfile();
  const admin = isAdmin(current?.profile);
  const today = todayISO();
  const monthStart = `${today.slice(0, 7)}-01`;
  const in7 = toISODate(addDays(parseISO(today), 7));
  const monthEnd = toISODate(endOfMonth(parseISO(today)));
  const monthLabel = formatDf(parseISO(today), "MMMM yyyy");

  const [
    { data: monthTravellers },
    { data: monthGroups },
    { data: invoicedRows },
    { count: travellerRowsNext7 },
    { data: b2bGroupsNext7 },
    { data: urgentRows },
    { data: recentInvoices },
    { data: groupRows },
    { data: completedRows },
  ] = await Promise.all([
    supabase
      .from("travellers")
      .select("id, traveller_ref, full_name, phone, nationality, passport_number, travel_start_date, travel_end_date, status, package_tier, hotel_name, hotel_stars, transit_location, group:travel_groups(id, travel_date, travel_end_date, group_code, label, group_documents(doc_type, deleted_at)), traveller_documents(doc_type, deleted_at)")
      .gte("travel_start_date", monthStart)
      .lte("travel_start_date", monthEnd)
      .neq("status", "cancelled")
      .order("travel_start_date")
      .order("full_name")
      .limit(300),
    // Partner (B2B) groups carry a pax count instead of traveller records, so they are counted from the group.
    supabase.from("travel_groups").select("id, source, pax_expected, travel_date, travellers(id, status)").gte("travel_date", monthStart).lte("travel_date", monthEnd),
    supabase.from("invoices").select("id, total").eq("currency", "USD").in("status", ["issued", "paid"]).gte("issue_date", monthStart),
    supabase
      .from("travellers")
      .select("id", { count: "exact", head: true })
      .gte("travel_start_date", today)
      .lte("travel_start_date", in7)
      .neq("status", "cancelled"),
    supabase.from("travel_groups").select("id, pax_expected, travellers(id, status)").eq("source", "b2b").gte("travel_date", today).lte("travel_date", in7),
    supabase
      .from("travellers")
      .select("id, full_name, travel_start_date, status, group:travel_groups(travel_date, group_code, label, group_documents(doc_type, deleted_at)), traveller_documents(doc_type, deleted_at)")
      .gte("travel_start_date", today)
      .lte("travel_start_date", in7)
      .not("status", "in", "(cancelled,travelled)")
      .order("travel_start_date"),
    supabase
      .from("invoices")
      .select("id, invoice_number, bill_to_name, issue_date, total, currency, status, deal_id")
      .order("sequence_number", { ascending: false })
      .limit(8),
    supabase
      .from("travel_groups")
      .select("id, travel_date, travel_end_date, group_code, label, guide_name, entry_port, exit_port, source, partner_code, pax_expected, pack_path, visa_status, visa_applied_at, visa_uploaded_at, visa_path, group_documents(doc_type, deleted_at), travellers(id, status, traveller_documents(doc_type, deleted_at))")
      .gte("travel_end_date", today)
      .order("travel_date", { ascending: true })
      .order("group_code", { ascending: true })
      .limit(9),
    // Groups whose exit date has passed (the border crossing is behind them), most recent first.
    supabase
      .from("travel_groups")
      .select("id, travel_date, travel_end_date, group_code, label, exit_port, source, partner_code, pax_expected, visa_status, travellers(id, status)")
      .lt("travel_end_date", today)
      .gte("travel_end_date", toISODate(subDays(parseISO(today), 30)))
      .order("travel_end_date", { ascending: false })
      .order("group_code", { ascending: true })
      .limit(12),
  ]);

  const completedGroups = (completedRows ?? []).map((g) => {
    const active = g.travellers.filter((t) => t.status !== "cancelled");
    const b2b = g.source === "b2b";
    const daysAgo = -(daysFromToday(g.travel_end_date) ?? 0);
    return { ...g, b2b, pax: b2b && g.pax_expected && active.length === 0 ? g.pax_expected : active.length, daysAgo, travelled: active.length > 0 && active.every((t) => t.status === "travelled") };
  });
  const completedPax = completedGroups.reduce((n, g) => n + g.pax, 0);

  const upcomingGroups = (groupRows ?? []).map((g) => {
    const active = g.travellers.filter((t) => t.status !== "cancelled");
    const complete = active.filter((t) => docCompleteness(t.traveller_documents, g.group_documents).complete).length;
    const days = daysFromToday(g.travel_date) ?? 0;
    const b2b = g.source === "b2b";
    return { ...g, b2b, pax: b2b && g.pax_expected ? g.pax_expected : active.length, complete, days, travelling: days <= 0 };
  });

  const invoiced = (invoicedRows ?? []).reduce((s, r) => s + Number(r.total), 0);
  // Received / balance per invoice, for the month tile and the recent list.
  const paymentIds = [...new Set([...(invoicedRows ?? []).map((r) => r.id), ...(recentInvoices ?? []).map((r) => r.id)])];
  const { data: paymentRows } = paymentIds.length ? await supabase.rpc("invoice_payment_summary", { p_ids: paymentIds }) : { data: [] as { invoice_id: string; received: number; balance: number; receipt_count: number }[] };
  const payments = new Map((paymentRows ?? []).map((r) => [r.invoice_id, { received: Number(r.received), balance: Number(r.balance) }]));
  const monthReceived = (invoicedRows ?? []).reduce((s, r) => s + (payments.get(r.id)?.received ?? 0), 0);
  const monthBalance = Math.max(0, Math.round((invoiced - monthReceived) * 100) / 100);
  const recent = (recentInvoices ?? []).map((inv) => {
    const p = payments.get(inv.id) ?? { received: 0, balance: Number(inv.total) };
    const paid = inv.status === "paid" || (p.balance <= 0 && Number(inv.total) > 0);
    const partial = !paid && p.received > 0;
    return { ...inv, received: p.received, balance: Math.max(0, p.balance), paid, partial };
  });
  const travellersThisMonth = (monthTravellers ?? []).map((t) => ({ ...t, docs: docCompleteness(t.traveller_documents, t.group?.group_documents), days: daysFromToday(t.travel_start_date) ?? 0 }));
  const monthComplete = travellersThisMonth.filter((t) => t.docs.complete).length;
  const monthTravelledOrTravelling = travellersThisMonth.filter((t) => t.days <= 0).length;
  // A partner group's pax counts only where it has no traveller records of its own (they would already be in the list above).
  const partnerPax = (groups: { source?: string; pax_expected: number | null; travellers: { status: string }[] }[]) =>
    groups.filter((g) => (g.source ?? "b2b") === "b2b" && !g.travellers.some((t) => t.status !== "cancelled")).reduce((n, g) => n + (g.pax_expected ?? 0), 0);
  const monthPartnerPax = partnerPax(monthGroups ?? []);
  const monthPartnerDeparted = (monthGroups ?? []).filter((g) => g.source === "b2b" && !g.travellers.some((t) => t.status !== "cancelled") && (daysFromToday(g.travel_date) ?? 0) <= 0).reduce((n, g) => n + (g.pax_expected ?? 0), 0);
  const totalThisMonth = travellersThisMonth.length + monthPartnerPax;
  const groupsThisMonth = monthGroups?.length ?? 0;
  const travellersNext7 = (travellerRowsNext7 ?? 0) + partnerPax(b2bGroupsNext7 ?? []);

  const urgent = (urgentRows ?? [])
    .map((t) => ({ ...t, docs: docCompleteness(t.traveller_documents, t.group?.group_documents) }))
    .filter((t) => !t.docs.complete);

  return (
    <>
      <PageHeader title="Dashboard" description={formatDate(today)} />

      <StatGrid cols={6}>
        <StatCard label="Travellers this month" value={totalThisMonth} hint={`${monthTravelledOrTravelling + monthPartnerDeparted} departed · ${monthPartnerPax} in partner packs · ${monthComplete} of ours fully documented`} href="/travel/travellers" icon={<Users />} />
        <StatCard label="Next 7 days" value={travellersNext7} hint={`${formatDate(today)} to ${formatDate(in7)}`} href="/travel?view=week" tone={travellersNext7 ? "warning" : "neutral"} icon={<Plane />} />
        <StatCard label="Groups this month" value={groupsThisMonth} hint={monthLabel} href="/travel?view=month" />
        <StatCard label="Docs incomplete" value={urgent.length} hint="travellers departing within 7 days" tone={urgent.length ? "red" : "success"} href="/travel/travellers" icon={<AlertTriangle />} />
        <StatCard label="Invoiced" value={`USD ${formatNumber(invoiced)}`} hint={`${monthLabel} · USD invoices`} href="/invoices" />
        <StatCard label="Outstanding" value={`USD ${formatNumber(monthBalance)}`} hint={`received USD ${formatNumber(monthReceived)}`} tone={monthBalance > 0 ? "warning" : "success"} href={admin ? "/accounts/receivables" : "/invoices"} />
      </StatGrid>

      {completedGroups.length > 0 && (
        <Section id="completed-groups" title="Travel completed" icon={<CheckCircle2 />} hint={`${completedPax} traveller${completedPax === 1 ? "" : "s"} back in the last 30 days`} link={{ href: "/travel/travellers?status=travelled", label: "All travelled" }}>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {completedGroups.map((g) => (
              <li key={g.id} className="rounded-lg border border-mr-success/30 bg-mr-success/5 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="tnum text-xs font-medium text-mr-body">{formatDateRange(g.travel_date, g.travel_end_date)}</p>
                    <Link href={`/travel?date=${g.travel_date}`} className="mt-0.5 block truncate font-heading text-lg font-semibold text-mr-ink hover:underline">
                      {g.group_code}
                      {g.partner_code && <Chip tone="ink" className="ml-2 align-middle font-sans">{g.b2b ? "B2B" : "Partner"} {g.partner_code}</Chip>}
                      {g.label ? <span className="font-sans text-sm font-normal text-mr-body"> · {g.label}</span> : null}
                    </Link>
                  </div>
                  <Chip tone="success" className="shrink-0">{g.daysAgo === 0 ? "Exited today" : g.daysAgo === 1 ? "Exited yesterday" : `Exited ${g.daysAgo} days ago`}</Chip>
                </div>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <div>
                    <p className="micro-label">Travellers</p>
                    <p className="tnum mt-1 font-heading text-2xl font-semibold leading-none text-mr-ink">{g.pax}</p>
                  </div>
                  <p className="truncate text-right text-xs text-mr-muted">
                    {g.exit_port ? `Out: ${g.exit_port}` : ""}
                    {!g.b2b && g.pax > 0 ? (
                      <span className={cn("block", g.travelled ? "text-mr-success" : "text-mr-warning")}>{g.travelled ? "Marked travelled" : "Not yet marked travelled"}</span>
                    ) : null}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section id="upcoming-groups" title="Travelling groups" icon={<Plane />} hint={upcomingGroups.length ? `${upcomingGroups.length} shown, soonest first` : undefined} link={{ href: "/travel?view=all", label: "All groups" }}>
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
                      {g.partner_code && <Chip tone="ink" className="ml-2 align-middle font-sans">{g.b2b ? "B2B" : "Partner"} {g.partner_code}</Chip>}
                      {g.label ? <span className="font-sans text-base font-normal text-mr-body"> · {g.label}</span> : null}
                    </Link>
                  </div>
                  <Chip tone={g.travelling ? "ink" : g.days <= 7 ? "warning" : "neutral"} className="shrink-0">{g.travelling ? "Travelling now" : g.days === 1 ? "Tomorrow" : `In ${g.days} days`}</Chip>
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
                      <DownloadBundleButton
                        group={{
                          id: g.id,
                          source: g.source,
                          partner_code: g.partner_code,
                          visa_status: g.visa_status,
                          visa_applied_at: g.visa_applied_at,
                          visa_uploaded_at: g.visa_uploaded_at,
                          visa_path: g.visa_path,
                          pack_path: g.pack_path,
                          traveller_count: g.pax,
                        }}
                      />
                    ) : null
                  ) : (
                    <CompileGroupButton groupId={g.id} travellerCount={g.pax} />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
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
                        {t.package_tier ? ` · ${packageDetail(t.package_tier, t.hotel_stars, t.hotel_name, t.transit_location)}` : ""}
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
            {recent.length === 0 ? (
              <p className="text-sm text-mr-muted">No invoices yet.</p>
            ) : (
              <ul className="divide-y divide-mr-line">
                {recent.map((inv) => (
                  <li key={inv.id} className="py-2.5 text-sm">
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <Link href={`/invoices/${inv.id}`} className="block truncate font-medium text-mr-ink hover:underline">
                          {inv.invoice_number}
                          <span className="font-normal text-mr-body"> · {inv.bill_to_name}</span>
                        </Link>
                        <p className="tnum truncate text-xs text-mr-muted">
                          {formatDate(inv.issue_date)} · Total {formatMoney(inv.total, inv.currency)}
                          {inv.status === "cancelled" ? "" : inv.paid ? " · Received in full" : inv.partial ? ` · Received ${formatMoney(inv.received, inv.currency)}` : " · Not received"}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className={cn("tnum font-medium", inv.status !== "cancelled" && !inv.paid && "text-mr-red")}>{inv.status === "cancelled" ? formatMoney(inv.total, inv.currency) : formatMoney(inv.paid ? inv.total : inv.balance, inv.currency)}</p>
                        <p className="text-[11px] text-mr-muted">{inv.status === "cancelled" ? "cancelled" : inv.paid ? "paid" : inv.partial ? "balance due" : "due"}</p>
                      </div>
                    </div>
                    {inv.status !== "cancelled" && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <StatusPill
                          label={inv.status === "draft" ? "Draft" : inv.paid ? "Paid" : inv.partial ? "Partially paid" : "Unpaid"}
                          tone={inv.status === "draft" ? "neutral" : inv.paid ? "success" : inv.partial ? "warning" : "red"}
                        />
                        {inv.status === "issued" && !inv.paid && <MarkPaidButton invoiceId={inv.id} invoiceNumber={inv.invoice_number} balance={inv.balance} currency={inv.currency} />}
                        {admin && inv.status === "issued" && !inv.paid && (
                          <RecordReceiptButton
                            size="xs"
                            variant="ghost"
                            label="Receive in Accounts"
                            invoice={{ id: inv.id, invoice_number: inv.invoice_number, bill_to_name: inv.bill_to_name, issue_date: inv.issue_date, total: Number(inv.total), currency: inv.currency, status: inv.status, deal_id: inv.deal_id, received: inv.received, balance: inv.balance }}
                          />
                        )}
                      </div>
                    )}
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
