import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Download, Layers, Plus } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { StatusPill, TRAVELLER_TONES } from "@/components/shared/status-pill";
import { DocsBadge, PackageBadge } from "@/components/travel/traveller-table";
import { CompileGroupButton } from "@/components/travel/pack-panel";
import { TravelRangeNav, type RangeView } from "@/components/travel/date-param";
import { GroupRowActions, GroupsToolbar } from "@/components/travel/groups-manager";
import { RemoveFromGroupButton } from "@/components/travel/remove-from-group-button";
import { StopToggle } from "@/components/shared/stop-toggle";
import { GroupVisaPanel, VisaStatusPill } from "@/components/travel/group-visa";
import { packageDetail } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { docCompleteness, groupCoverage, groupPackReference, groupRef } from "@/lib/queries/travel";
import { GroupDocuments } from "@/components/travel/group-documents";
import { TRAVELLER_STATUSES, labelFor } from "@/lib/constants";
import { formatDate, formatDateRange, todayISO, toISODate } from "@/lib/format";
import { addMonths, addWeeks, endOfMonth, endOfWeek, format as formatDf, parseISO, startOfMonth, startOfWeek } from "date-fns";

export const metadata: Metadata = { title: "Travel" };

export default async function TravelByGroupPage({ searchParams }: { searchParams: Promise<{ date?: string; view?: string }> }) {
  const sp = await searchParams;
  const view: RangeView = sp.view === "week" || sp.view === "month" || sp.view === "quarter" ? sp.view : "day";
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
    view === "week"
      ? `Week of ${formatDate(rangeStart)} to ${formatDate(rangeEnd)}`
      : view === "month"
        ? formatDf(range.start, "MMMM yyyy")
        : view === "quarter"
          ? `${formatDf(range.start, "MMM yyyy")} to ${formatDf(range.end, "MMM yyyy")}`
          : formatDate(date);

  const { data: groups, error } = await supabase
    .from("travel_groups")
    .select(
      "id, travel_date, travel_end_date, group_code, label, guide_name, notes, reference_prefix, entry_port, exit_port, source, partner_code, pax_expected, pack_path, package_tier, hotel_name, hotel_stars, transit_location, visa_status, visa_applied_at, visa_uploaded_at, visa_path, group_ref, group_documents(id, doc_type, file_name, file_size, uploaded_at, deleted_at), travellers(id, full_name, status, package_tier, passport_number, visa_reference, traveller_documents(doc_type, deleted_at))",
    )
    .lte("travel_date", view === "day" ? date : rangeEnd)
    .gte(view === "day" ? "travel_date" : "travel_end_date", view === "day" ? date : rangeStart)
    .order("travel_date")
    .order("group_code")
    .limit(400);

  const totalTravellers = (groups ?? []).reduce((n, g) => n + (g.source === "b2b" && g.pax_expected && g.travellers.length === 0 ? g.pax_expected : g.travellers.filter((t) => t.status !== "cancelled").length), 0);
  const partnerCodes = [...new Set((groups ?? []).map((g) => g.partner_code).filter((c): c is string => !!c))];
  const { data: partnerRows } = partnerCodes.length ? await supabase.from("b2b_partners").select("code, logo_path").in("code", partnerCodes) : { data: [] as { code: string; logo_path: string | null }[] };
  const partnerHasLogo = new Map((partnerRows ?? []).map((p) => [p.code, !!p.logo_path]));

  const paxOf = (g: NonNullable<typeof groups>[number]) => (g.source === "b2b" && g.pax_expected && g.travellers.length === 0 ? g.pax_expected : g.travellers.filter((t) => t.status !== "cancelled").length);
  const byDate = Object.entries((groups ?? []).reduce<Record<string, NonNullable<typeof groups>>>((acc, g) => ((acc[g.travel_date] ??= []).push(g), acc), {})).sort(([a], [b]) => a.localeCompare(b));
  const renderCard = (g: NonNullable<typeof groups>[number]) => {
            const travellers = [...g.travellers].sort((a, b) => a.full_name.localeCompare(b.full_name));
            const groupDocs = (g.group_documents ?? []).filter((d) => !d.deleted_at);
            const coverage = groupCoverage(groupDocs);
            const complete = travellers.filter((t) => docCompleteness(t.traveller_documents, coverage).complete).length;
            return (
              <details key={g.id} className="group rounded-lg border border-mr-line bg-white open:border-mr-ink" open={travellers.length > 0 && (groups?.length ?? 0) <= 4}>
                <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                  <span className="text-base font-semibold text-mr-ink">{g.group_code}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-mr-body">
                    {g.source === "b2b" && <span className="mr-2 rounded-md bg-mr-ink px-1.5 py-0.5 text-[11px] font-medium text-white">B2B {g.partner_code}</span>}
                    {g.label ?? <span className="text-mr-muted">No label</span>}
                    {g.guide_name ? ` · ${g.guide_name}` : ""}
                    <span className="block truncate text-xs text-mr-muted">
                      {formatDateRange(g.travel_date, g.travel_end_date)} · ID {g.group_ref ?? groupRef(g)} · {groupPackReference(g, travellers.length)}
                    </span>
                    <span className="block truncate text-xs text-mr-muted">
                      {g.entry_port && g.exit_port ? `In: ${g.entry_port} · Out: ${g.exit_port}` : <span className="text-mr-warning">Entry / exit port missing</span>}
                      {g.package_tier ? ` · ${packageDetail(g.package_tier, g.hotel_stars, g.hotel_name, g.transit_location)}` : ""}
                    </span>
                  </span>
                  <VisaStatusPill group={g} className="hidden lg:inline-flex" />
                  <span className="tnum text-xs text-mr-body">
                    {g.source === "b2b" && g.pax_expected ? `${g.pax_expected} pax` : `${travellers.length} pax`}
                  </span>
                  {g.source !== "b2b" && <DocsBadge count={complete} total={travellers.length || 0} />}
                  <StopToggle>
                    <GroupRowActions
                      group={{
                        id: g.id,
                        travel_date: g.travel_date,
                        travel_end_date: g.travel_end_date,
                        group_code: g.group_code,
                        label: g.label,
                        guide_name: g.guide_name,
                        notes: g.notes,
                        reference_prefix: g.reference_prefix,
                        entry_port: g.entry_port,
                        exit_port: g.exit_port,
                        package_tier: g.package_tier,
                        hotel_name: g.hotel_name,
                        hotel_stars: g.hotel_stars,
                        transit_location: g.transit_location,
                        source: g.source,
                        partner_code: g.partner_code,
                        pax_expected: g.pax_expected,
                        traveller_count: travellers.length,
                        created_by_name: null,
                        created_at: null,
                      }}
                    />
                  </StopToggle>
                </summary>
                <div className="border-t border-mr-line px-4 py-3">
                  {travellers.length === 0 ? (
                    <p className="text-sm text-mr-muted">
                      {g.source === "b2b" ? `Partner group: ${g.partner_code} compiled this pack themselves (${g.pax_expected ?? 0} pax). No individual travellers are tracked here.` : "No travellers assigned yet."}
                    </p>
                  ) : (
                    <ul className="divide-y divide-mr-line">
                      {travellers.map((t) => {
                        const c = docCompleteness(t.traveller_documents, coverage);
                        return (
                          <li key={t.id} className="flex items-center gap-3 py-2">
                            <div className="min-w-0 flex-1">
                              <Link href={`/travel/travellers/${t.id}`} className="block truncate text-sm font-medium text-mr-ink hover:underline">
                                {t.full_name}
                              </Link>
                              <p className="truncate text-xs text-mr-muted">
                                {t.passport_number ?? "No passport no."}
                                {t.visa_reference ? ` · ${t.visa_reference}` : ""}
                              </p>
                            </div>
                            <PackageBadge tier={t.package_tier} />
                            <StatusPill label={labelFor(TRAVELLER_STATUSES, t.status)} tone={TRAVELLER_TONES[t.status]} className="hidden sm:inline-flex" />
                            <DocsBadge count={c.count} total={c.total} />
                            <RemoveFromGroupButton travellerId={t.id} travellerName={t.full_name} groupCode={g.group_code} />
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <div className="mt-3 border-t border-mr-line pt-3">
                    <GroupDocuments groupId={g.id} documents={groupDocs} />
                  </div>
                  <div className="mt-3 border-t border-mr-line pt-3">
                    <GroupVisaPanel
                      group={{
                        id: g.id,
                        source: g.source,
                        partner_code: g.partner_code,
                        visa_status: g.visa_status,
                        visa_applied_at: g.visa_applied_at,
                        visa_uploaded_at: g.visa_uploaded_at,
                        visa_path: g.visa_path,
                        pack_path: g.pack_path,
                        traveller_count: travellers.length,
                        partner_has_logo: g.partner_code ? (partnerHasLogo.get(g.partner_code) ?? false) : false,
                      }}
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="flex items-center gap-3">
                      <Link href={`/travel/travellers/new?group=${g.id}`} className="text-xs text-mr-body hover:text-mr-ink hover:underline">
                        + Add traveller
                      </Link>
                      <Link href={`/invoices/new?group=${g.id}`} className="text-xs text-mr-body hover:text-mr-ink hover:underline">
                        + Create invoice
                      </Link>
                    </span>
                    {g.source === "b2b" ? (
                      g.pack_path ? (
                        <a href={`/api/groups/${g.id}/bundle`} title="Mandarin Roots cover with the travel details, then the partner's pack; after the visa is received, the partner's own branding" className={buttonVariants({ size: "sm" })}>
                          <Download /> Download pack
                        </a>
                      ) : (
                        <Link href="/travel/b2b" className="text-xs text-mr-warning hover:underline">
                          No pack file yet
                        </Link>
                      )
                    ) : (
                      <CompileGroupButton groupId={g.id} travellerCount={travellers.length} />
                    )}
                  </div>
                </div>
              </details>
            );
  };

  return (
    <>
      <PageHeader
        title="Travel by group"
        description={`${rangeLabel} · ${groups?.length ?? 0} groups · ${totalTravellers} travellers (own and partner groups, all packages)`}
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
        <div className="mb-6">
          <TravelRangeNav view={view} date={view === "day" ? date : toISODate(anchor)} today={today} prev={view === "day" ? prev : step(-1)} next={view === "day" ? next : step(1)} nearby={nearby} rangeLabel={rangeLabel} />
        </div>
      </Suspense>

      {error ? (
        <p className="text-sm text-mr-red">Could not load groups: {error.message}</p>
      ) : !groups || groups.length === 0 ? (
        <EmptyState icon={Layers} title={view === "day" ? `No groups on ${formatDate(date)}. Create them, or pick another date.` : `No groups travelling in ${rangeLabel}.`} action={<GroupsToolbar />} />
      ) : (
        view === "day" ? (
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">{groups.map(renderCard)}</div>
        ) : (
          <div className="space-y-8">
            {byDate.map(([d, list]) => (
              <section key={d} aria-labelledby={`day-${d}`}>
                <h2 id={`day-${d}`} className="mb-3 flex items-baseline gap-3 border-b border-mr-line pb-2">
                  <Link href={`/travel?date=${d}`} className="font-heading text-lg font-semibold text-mr-ink hover:underline">
                    {formatDate(d)}
                  </Link>
                  <span className="text-sm text-mr-muted">
                    {list.length} group{list.length === 1 ? "" : "s"} · {list.reduce((n, g) => n + paxOf(g), 0)} pax
                  </span>
                </h2>
                <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">{list.map(renderCard)}</div>
              </section>
            ))}
          </div>
        )
      )}
    </>
  );
}
