import type { Metadata } from "next";
import Link from "next/link";
import { Hotel, Plus } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { StatusPill, TRAVELLER_TONES } from "@/components/shared/status-pill";
import { DocsBadge } from "@/components/travel/traveller-table";
import { createClient } from "@/lib/supabase/server";
import { docCompleteness, groupTitle } from "@/lib/queries/travel";
import { PACKAGE_TIERS, TRAVELLER_STATUSES, labelFor } from "@/lib/constants";
import { formatDate, formatDateRange, todayISO } from "@/lib/format";
import { addDays, parseISO } from "date-fns";
import { toISODate } from "@/lib/format";

export const metadata: Metadata = { title: "Packages" };

/**
 * Travellers on hotel packages, grouped by tier. Shows everyone travelling
 * from a week ago onwards so packages in progress and upcoming ones are visible.
 */
export default async function PackagesPage({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const { all } = await searchParams;
  const supabase = await createClient();
  const today = todayISO();
  const from = toISODate(addDays(parseISO(today), -7));

  let query = supabase
    .from("travellers")
    .select(
      "id, traveller_ref, full_name, phone, travel_start_date, travel_end_date, status, package_tier, group:travel_groups(travel_date, travel_end_date, group_code, label), traveller_documents(doc_type, deleted_at)",
    )
    .not("package_tier", "is", null)
    .neq("status", "cancelled")
    .order("travel_start_date", { ascending: true })
    .order("full_name")
    .limit(500);
  if (all !== "1") query = query.gte("travel_end_date", from);
  const { data, error } = await query;

  const byTier = new Map<string, NonNullable<typeof data>>();
  PACKAGE_TIERS.forEach((t) => byTier.set(t.value, []));
  (data ?? []).forEach((t) => byTier.get(t.package_tier ?? "")?.push(t));
  const total = data?.length ?? 0;

  return (
    <>
      <PageHeader
        title="Packages"
        description={`${total} traveller${total === 1 ? "" : "s"} on hotel packages${all === "1" ? " (all time)" : ", travelling from a week ago onwards"}.`}
        actions={
          <>
            <Link href={all === "1" ? "/travel/packages" : "/travel/packages?all=1"} className={buttonVariants({ variant: "outline" })}>
              {all === "1" ? "Show upcoming only" : "Show all time"}
            </Link>
            <Link href="/travel/travellers/new" className={buttonVariants()}>
              <Plus /> New traveller
            </Link>
          </>
        }
      />

      {error ? (
        <p className="text-sm text-mr-red">Could not load packages: {error.message}</p>
      ) : total === 0 ? (
        <EmptyState
          icon={Hotel}
          title="No package travellers yet. Set a hotel package on a traveller, or mark a lead as a package enquiry and add them to travel."
          action={
            <Link href="/travel/travellers/new" className={buttonVariants()}>
              <Plus /> New traveller
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-3">
          {PACKAGE_TIERS.map((tier) => {
            const list = byTier.get(tier.value) ?? [];
            const complete = list.filter((t) => docCompleteness(t.traveller_documents).complete).length;
            return (
              <section key={tier.value} className="rounded-lg border border-mr-line bg-white">
                <header className="flex items-center justify-between border-b border-mr-line px-4 py-3">
                  <h2 className="text-base">{tier.label} package</h2>
                  <span className="tnum text-xs text-mr-body">
                    {list.length} pax · <DocsBadge count={complete} total={list.length} />
                  </span>
                </header>
                {list.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-mr-muted">No {tier.label.toLowerCase()} travellers in this window.</p>
                ) : (
                  <ul className="divide-y divide-mr-line">
                    {list.map((t) => {
                      const c = docCompleteness(t.traveller_documents);
                      return (
                        <li key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                          <div className="min-w-0 flex-1">
                            <Link href={`/travel/travellers/${t.id}`} className="block truncate text-sm font-medium text-mr-ink hover:underline">
                              {t.full_name}
                            </Link>
                            <p className="truncate text-xs text-mr-muted">
                              {formatDateRange(t.travel_start_date, t.travel_end_date)}
                              {t.group ? ` · ${groupTitle(t.group)}` : " · no group"}
                            </p>
                          </div>
                          <StatusPill label={labelFor(TRAVELLER_STATUSES, t.status)} tone={TRAVELLER_TONES[t.status]} className="hidden sm:inline-flex" />
                          <DocsBadge count={c.count} total={c.total} />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
      <p className="mt-4 text-xs text-mr-muted">Window starts {formatDate(from)}. Use &ldquo;Show all time&rdquo; for past packages.</p>
    </>
  );
}
