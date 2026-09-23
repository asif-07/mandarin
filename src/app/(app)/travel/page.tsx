import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Layers, Plus } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { TravelRangeNav, type RangeView } from "@/components/travel/date-param";
import { GroupsToolbar } from "@/components/travel/groups-manager";
import { GroupCard } from "@/components/travel/group-card";
import { StatCard, StatGrid } from "@/components/shared/stat-card";
import { groupIssues, groupPax } from "@/lib/queries/group-status";
import { createClient } from "@/lib/supabase/server";
import { formatDate, todayISO, toISODate } from "@/lib/format";
import { addMonths, addWeeks, endOfMonth, endOfWeek, format as formatDf, parseISO, startOfMonth, startOfWeek } from "date-fns";

export const metadata: Metadata = { title: "Travel" };

export default async function TravelByGroupPage({ searchParams }: { searchParams: Promise<{ date?: string; view?: string }> }) {
  const sp = await searchParams;
  const view: RangeView = sp.view === "all" || sp.view === "week" || sp.view === "month" || sp.view === "quarter" ? sp.view : "day";
  const supabase = await createClient();
  const today = todayISO();

  // Distinct travel dates that have groups, for navigation.
  const { data: dateRows } = await supabase
    .from("travel_groups")
    .select("travel_date")
    .order("travel_date", { ascending: true })
    .limit(2000);
  const dates = [...new Set((dateRows ?? []).map((r) => r.travel_date))];

  const requested = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : null;
  const date = requested ?? dates.find((d) => d >= today) ?? dates[dates.length - 1] ?? today;
  const idx = dates.indexOf(date);
  const prev = idx > 0 ? dates[idx - 1]! : idx === -1 ? [...dates].reverse().find((d) => d < date) ?? null : null;
  const next = idx >= 0 && idx < dates.length - 1 ? dates[idx + 1]! : idx === -1 ? dates.find((d) => d > date) ?? null : null;
  const nearby = dates.filter((d) => Math.abs((Date.parse(d) - Date.parse(date)) / 86_400_000) <= 21).slice(0, 8);

  // Week / month / 3-month windows around the chosen date (weeks start on Monday). Groups whose travel window overlaps the range are shown.
  const anchor = parseISO(view === "day" ? date : (requested ?? today));
  const range =
    view === "week"
      ? { start: startOfWeek(anchor, { weekStartsOn: 1 }), end: endOfWeek(anchor, { weekStartsOn: 1 }) }
      : view === "month"
        ? { start: startOfMonth(anchor), end: endOfMonth(anchor) }
        : view === "quarter"
          ? { start: startOfMonth(anchor), end: endOfMonth(addMonths(anchor, 2)) }
          : { start: anchor, end: anchor };
  const rangeStart = toISODate(range.start);
  const rangeEnd = toISODate(range.end);
  const step = (n: number) => toISODate(view === "week" ? addWeeks(range.start, n) : view === "month" ? addMonths(range.start, n) : addMonths(range.start, 3 * n));
  const rangeLabel =
    view === "all"
      ? "All groups · upcoming first, then past"
      : view === "week"
      ? `Week of ${formatDate(rangeStart)} to ${formatDate(rangeEnd)}`
      : view === "month"
        ? formatDf(range.start, "MMMM yyyy")
        : view === "quarter"
          ? `${formatDf(range.start, "MMM yyyy")} to ${formatDf(range.end, "MMM yyyy")}`
          : formatDate(date);

  let groupsQuery = supabase
    .from("travel_groups")
    .select(
      "id, travel_date, travel_end_date, group_code, label, guide_name, notes, reference_prefix, entry_port, exit_port, source, partner_code, pax_expected, pack_path, package_tier, hotel_name, hotel_stars, transit_location, visa_status, visa_applied_at, visa_uploaded_at, visa_path, group_ref, invoices:invoices!invoices_travel_group_id_fkey(id, invoice_number, total, currency, status), group_documents(id, doc_type, file_name, file_size, uploaded_at, deleted_at), travellers(id, full_name, status, package_tier, passport_number, visa_reference, traveller_documents(doc_type, deleted_at))",
    )
    .order("travel_date")
    .order("group_code")
    .limit(view === "all" ? 1000 : 400);
  if (view === "day") groupsQuery = groupsQuery.eq("travel_date", date);
  else if (view !== "all") groupsQuery = groupsQuery.lte("travel_date", rangeEnd).gte("travel_end_date", rangeStart);
  const { data: groups, error } = await groupsQuery;

  // Received / balance for every invoice on the page, so unpaid groups can be flagged.
  const invoiceIds = (groups ?? []).flatMap((g) => g.invoices.filter((i) => i.status !== "cancelled").map((i) => i.id));
  const { data: paymentRows } = invoiceIds.length ? await supabase.rpc("invoice_payment_summary", { p_ids: invoiceIds }) : { data: [] as { invoice_id: string; received: number; balance: number; receipt_count: number }[] };
  const balances = new Map((paymentRows ?? []).map((r) => [r.invoice_id, { received: Number(r.received), balance: Number(r.balance) }]));

  const list = groups ?? [];
  const issueList = list.map((g) => ({ g, issues: groupIssues(g, balances) }));
  const totalTravellers = list.reduce((n, g) => n + groupPax(g), 0);
  const stats = {
    groups: list.length,
    ready: issueList.filter((x) => x.issues.length === 0).length,
    docs: issueList.filter((x) => x.issues.some((i) => i.key === "docs" || i.key === "pack")).length,
    unbilled: issueList.filter((x) => x.issues.some((i) => i.key === "invoice")).length,
    unpaid: issueList.filter((x) => x.issues.some((i) => i.key === "unpaid")).length,
    visaOpen: list.filter((g) => g.visa_status !== "approved").length,
  };
  const partnerCodes = [...new Set(list.map((g) => g.partner_code).filter((c): c is string => !!c))];
  const { data: partnerRows } = partnerCodes.length ? await supabase.from("b2b_partners").select("code, logo_path").in("code", partnerCodes) : { data: [] as { code: string; logo_path: string | null }[] };
  const partnerHasLogo = new Map((partnerRows ?? []).map((p) => [p.code, !!p.logo_path]));

  // Sections per departure date. "All" puts today's and upcoming dates first (soonest at the top), then past dates most recent first.
  const byDate = Object.entries(list.reduce<Record<string, typeof list>>((acc, g) => ((acc[g.travel_date] ??= []).push(g), acc), {})).sort(([a], [b]) => {
    if (view !== "all") return a.localeCompare(b);
    const aUp = a >= today;
    const bUp = b >= today;
    if (aUp !== bUp) return aUp ? -1 : 1;
    return aUp ? a.localeCompare(b) : b.localeCompare(a);
  });
  const card = (g: (typeof list)[number]) => <GroupCard key={g.id} g={g} balances={balances} partnerHasLogo={g.partner_code ? (partnerHasLogo.get(g.partner_code) ?? false) : false} defaultOpen={view === "day" && list.length <= 2} />;

  return (
    <>
      <PageHeader
        title="Travel by group"
        description={`${rangeLabel} · ${stats.groups} group${stats.groups === 1 ? "" : "s"} · ${totalTravellers} travellers`}
        actions={
          <>
            <GroupsToolbar />
            <Link href="/travel/travellers/new" className={buttonVariants({ variant: "outline" })}>
              <Plus /> New traveller
            </Link>
          </>
        }
      />
      <Suspense>
        <div className="mb-5">
          <TravelRangeNav view={view} date={view === "day" ? date : toISODate(anchor)} today={today} prev={view === "day" ? prev : step(-1)} next={view === "day" ? next : step(1)} nearby={nearby} rangeLabel={rangeLabel} />
        </div>
      </Suspense>

      {!error && list.length > 0 && (
        <StatGrid cols={6} className="mb-6">
          <StatCard label="Groups" value={stats.groups} hint={`${totalTravellers} travellers`} tone="ink" />
          <StatCard label="Ready" value={stats.ready} hint="nothing outstanding" tone={stats.ready === stats.groups ? "success" : "neutral"} />
          <StatCard label="Missing documents" value={stats.docs} hint="groups with gaps" tone={stats.docs ? "red" : "success"} />
          <StatCard label="Unbilled" value={stats.unbilled} hint="no invoice yet" tone={stats.unbilled ? "warning" : "success"} />
          <StatCard label="Unpaid" value={stats.unpaid} hint="invoice balance due" tone={stats.unpaid ? "warning" : "success"} />
          <StatCard label="Visa open" value={stats.visaOpen} hint="not yet received" tone={stats.visaOpen ? "warning" : "success"} />
        </StatGrid>
      )}

      {error ? (
        <p className="text-sm text-mr-red">Could not load groups: {error.message}</p>
      ) : list.length === 0 ? (
        <EmptyState icon={Layers} title={view === "day" ? `No groups on ${formatDate(date)}. Create them, or pick another date.` : `No groups travelling in ${rangeLabel}.`} action={<GroupsToolbar />} />
      ) : view === "day" ? (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">{list.map(card)}</div>
      ) : (
        <div className="space-y-8">
          {byDate.map(([d, dayGroups]) => (
            <section key={d} aria-labelledby={`day-${d}`}>
              <h2 id={`day-${d}`} className="mb-3 flex items-baseline gap-3 border-b border-mr-line pb-2">
                <Link href={`/travel?date=${d}`} className="font-heading text-lg font-semibold text-mr-ink hover:underline">
                  {formatDate(d)}
                </Link>
                <span className="text-sm text-mr-muted">
                  {dayGroups.length} group{dayGroups.length === 1 ? "" : "s"} · {dayGroups.reduce((n, g) => n + groupPax(g), 0)} pax
                </span>
              </h2>
              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">{dayGroups.map(card)}</div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
