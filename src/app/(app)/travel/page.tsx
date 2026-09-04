import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Layers, Plus } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { StatusPill, TRAVELLER_TONES } from "@/components/shared/status-pill";
import { DocsBadge, PackageBadge } from "@/components/travel/traveller-table";
import { CompileGroupButton } from "@/components/travel/pack-panel";
import { TravelDateNav } from "@/components/travel/date-param";
import { GroupRowActions, GroupsToolbar } from "@/components/travel/groups-manager";
import { RemoveFromGroupButton } from "@/components/travel/remove-from-group-button";
import { createClient } from "@/lib/supabase/server";
import { docCompleteness, groupPackReference } from "@/lib/queries/travel";
import { TRAVELLER_STATUSES, labelFor } from "@/lib/constants";
import { formatDate, formatDateRange, todayISO } from "@/lib/format";

export const metadata: Metadata = { title: "Travel" };

export default async function TravelByGroupPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const sp = await searchParams;
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

  const { data: groups, error } = await supabase
    .from("travel_groups")
    .select(
      "id, travel_date, travel_end_date, group_code, label, guide_name, notes, reference_prefix, travellers(id, full_name, status, package_tier, passport_number, visa_reference, traveller_documents(doc_type, deleted_at))",
    )
    .eq("travel_date", date)
    .order("group_code");

  const totalTravellers = (groups ?? []).reduce((n, g) => n + g.travellers.length, 0);

  return (
    <>
      <PageHeader
        title="Travel by group"
        description={`${formatDate(date)} · ${groups?.length ?? 0} groups · ${totalTravellers} travellers`}
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
          <TravelDateNav date={date} prev={prev} next={next} nearby={nearby} />
        </div>
      </Suspense>

      {error ? (
        <p className="text-sm text-mr-red">Could not load groups: {error.message}</p>
      ) : !groups || groups.length === 0 ? (
        <EmptyState icon={Layers} title={`No groups on ${formatDate(date)}. Create them, or pick another date.`} action={<GroupsToolbar />} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {groups.map((g) => {
            const travellers = [...g.travellers].sort((a, b) => a.full_name.localeCompare(b.full_name));
            const complete = travellers.filter((t) => docCompleteness(t.traveller_documents).complete).length;
            return (
              <details key={g.id} className="group rounded-lg border border-mr-line bg-white open:border-mr-ink" open={travellers.length > 0 && groups.length <= 4}>
                <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                  <span className="text-base font-semibold text-mr-ink">{g.group_code}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-mr-body">
                    {g.label ?? <span className="text-mr-muted">No label</span>}
                    {g.guide_name ? ` · ${g.guide_name}` : ""}
                    <span className="block truncate text-xs text-mr-muted">
                      {formatDateRange(g.travel_date, g.travel_end_date)} · {groupPackReference(g, travellers.length)}
                    </span>
                  </span>
                  <span className="tnum text-xs text-mr-body">
                    {travellers.length} pax
                  </span>
                  <DocsBadge count={complete} total={travellers.length || 0} />
                  <span onClick={(e) => e.preventDefault()} className="contents">
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
                        traveller_count: travellers.length,
                        created_by_name: null,
                        created_at: null,
                      }}
                    />
                  </span>
                </summary>
                <div className="border-t border-mr-line px-4 py-3">
                  {travellers.length === 0 ? (
                    <p className="text-sm text-mr-muted">No travellers assigned yet.</p>
                  ) : (
                    <ul className="divide-y divide-mr-line">
                      {travellers.map((t) => {
                        const c = docCompleteness(t.traveller_documents);
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
                  <div className="mt-3 flex items-center justify-between">
                    <Link href={`/travel/travellers/new`} className="text-xs text-mr-body hover:text-mr-ink hover:underline">
                      + Add traveller
                    </Link>
                    <CompileGroupButton groupId={g.id} travellerCount={travellers.length} />
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      )}
    </>
  );
}
