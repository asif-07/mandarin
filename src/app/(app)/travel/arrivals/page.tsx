import type { Metadata } from "next";
import Link from "next/link";
import { PlaneLanding } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";
import { StatCard, StatGrid } from "@/components/shared/stat-card";
import { Chip } from "@/components/shared/chip";
import { ArrivalActions, ArrivalsLinkButton } from "@/components/arrivals/arrival-admin";
import { requireProfile } from "@/lib/auth";
import { listArrivals } from "@/lib/arrivals/server";
import { ARRIVAL_STATUSES } from "@/lib/arrivals/shared";
import { labelFor } from "@/lib/constants";
import { formatDate, formatDateTime, todayISO } from "@/lib/format";

export const metadata: Metadata = { title: "Hong Kong arrivals" };
export const dynamic = "force-dynamic";

/** Inbox of arrival details sent by travel agents through the public link, grouped by arrival date, with replies and group attachment. */
export default async function ArrivalsInboxPage({ searchParams }: { searchParams: Promise<{ status?: string; scope?: string; partner?: string }> }) {
  await requireProfile();
  const sp = await searchParams;
  const today = todayISO();
  const scope = sp.scope === "all" ? "all" : "upcoming";
  const rows = await listArrivals({ status: sp.status, partner: sp.partner, from: scope === "upcoming" ? today : undefined });
  const byDate = new Map<string, typeof rows>();
  rows.forEach((r) => byDate.set(r.arrival_date, [...(byDate.get(r.arrival_date) ?? []), r]));
  const stats = { total: rows.length, pax: rows.reduce((n, r) => n + r.pax, 0), fresh: rows.filter((r) => r.status === "new").length, dates: byDate.size, partners: new Set(rows.map((r) => r.partner_code)).size };
  const q = (patch: Record<string, string | undefined>) => ({ pathname: "/travel/arrivals", query: Object.fromEntries(Object.entries({ status: sp.status, scope: sp.scope, partner: sp.partner, ...patch }).filter(([, v]) => v)) });

  return (
    <>
      <PageHeader title="Hong Kong group arrivals" description="Arrival details sent by travel agents through the public link. Reply with the transfer arrangement; attach same-day arrivals to one group." actions={<ArrivalsLinkButton />} />
      <div className="mb-4 flex flex-wrap gap-1 text-xs">
        <Link href={q({ scope: undefined })} className={`rounded-md px-2 py-1 ${scope === "upcoming" ? "bg-mr-ink text-white" : "bg-mr-surface text-mr-body hover:text-mr-ink"}`}>
          Upcoming
        </Link>
        <Link href={q({ scope: "all" })} className={`rounded-md px-2 py-1 ${scope === "all" ? "bg-mr-ink text-white" : "bg-mr-surface text-mr-body hover:text-mr-ink"}`}>
          All dates
        </Link>
        <span className="mx-2 text-mr-muted">·</span>
        <Link href={q({ status: undefined })} className={`rounded-md px-2 py-1 ${!sp.status ? "bg-mr-ink text-white" : "bg-mr-surface text-mr-body hover:text-mr-ink"}`}>
          Any status
        </Link>
        {ARRIVAL_STATUSES.map((s) => (
          <Link key={s.value} href={q({ status: s.value })} className={`rounded-md px-2 py-1 ${sp.status === s.value ? "bg-mr-ink text-white" : "bg-mr-surface text-mr-body hover:text-mr-ink"}`}>
            {s.label}
          </Link>
        ))}
      </div>
      {rows.length > 0 && (
        <StatGrid cols={5} className="mb-6">
          <StatCard label="Arrivals" value={stats.total} hint={`${stats.pax} pax`} tone="ink" />
          <StatCard label="New, unanswered" value={stats.fresh} hint="waiting for a reply" tone={stats.fresh ? "warning" : "success"} href="/travel/arrivals?status=new" />
          <StatCard label="Arrival dates" value={stats.dates} hint="days with arrivals" tone="neutral" />
          <StatCard label="Partners" value={stats.partners} hint="agencies sending" tone="neutral" />
          <StatCard label="Attached to groups" value={rows.filter((r) => r.group_id).length} hint={`of ${stats.total}`} tone="neutral" />
        </StatGrid>
      )}
      {rows.length === 0 ? (
        <EmptyState icon={PlaneLanding} title={scope === "upcoming" ? "No upcoming arrival details yet. Share the public link with your travel agents." : "No arrival details match."} action={<ArrivalsLinkButton />} />
      ) : (
        <div className="space-y-6">
          {[...byDate.entries()].map(([d, list]) => (
            <section key={d}>
              <h2 className="mb-2 flex items-baseline gap-3 border-b border-mr-line pb-1">
                <span className="font-heading text-lg font-semibold">{formatDate(d)}</span>
                <span className="text-sm text-mr-muted">
                  {list.length} arrival{list.length === 1 ? "" : "s"} · {list.reduce((n, r) => n + r.pax, 0)} pax
                </span>
              </h2>
              <ul className="divide-y divide-mr-line rounded-lg border border-mr-line bg-white">
                {list.map((a) => (
                  <li key={a.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="tnum w-14 text-sm font-semibold">{a.arrival_time}</span>
                      <Chip tone="ink">{a.partner_code}</Chip>
                      <span className="text-sm font-medium text-mr-ink">{a.airline_flight}</span>
                      <span className="tnum text-sm text-mr-body">{a.pax} pax</span>
                      <Chip tone={a.status === "new" ? "warning" : a.status === "closed" ? "muted" : "success"}>{labelFor(ARRIVAL_STATUSES, a.status)}</Chip>
                      {a.group_ref && (
                        <Chip tone="neutral" className="font-mono">
                          {a.group_ref}
                        </Chip>
                      )}
                      <span className="ml-auto font-mono text-[11px] text-mr-muted">{a.ref}</span>
                    </div>
                    <p className="mt-1 text-xs text-mr-muted">
                      {a.agent_name ? `From ${a.agent_name}` : "No agent name"}
                      {a.agent_phone ? ` · ${a.agent_phone}` : ""} · sent {formatDateTime(a.created_at)}
                      {a.agent_notes ? ` · "${a.agent_notes}"` : ""}
                    </p>
                    {a.admin_reply && (
                      <p className="mt-1 rounded-md bg-mr-success/5 px-2 py-1 text-xs text-mr-ink">
                        Reply{a.replied_by ? ` by ${a.replied_by}` : ""}: {a.admin_reply}
                      </p>
                    )}
                    <div className="mt-2">
                      <ArrivalActions a={a} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
