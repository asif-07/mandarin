import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeftRight } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";
import { StatCard, StatGrid } from "@/components/shared/stat-card";
import { Chip } from "@/components/shared/chip";
import { SearchParamInput } from "@/components/shared/url-filters";
import { TravelDateNav } from "@/components/travel/date-param";
import { MovementActions } from "@/components/travel/movement-actions";
import { WorkflowStatusChip } from "@/components/workflow/status-chip";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { groupRef } from "@/lib/queries/travel";
import { formatDate, formatDateTime, todayISO, toISODate } from "@/lib/format";
import { addDays, parseISO } from "date-fns";

export const metadata: Metadata = { title: "Entry / Exit" };
export const dynamic = "force-dynamic";

const SELECT = "id, group_ref, reference_prefix, partner_code, travel_date, travel_end_date, group_code, label, guide_name, entry_port, exit_port, pax_expected, source, workflow_status, china_entry_at, china_entry_confirmed_by, china_exit_at, china_exit_confirmed_by, travellers(full_name, status)";

/** Who enters and who exits China on a day, searchable, with manual Mark entered / Mark exited. */
export default async function MovementsPage({ searchParams }: { searchParams: Promise<{ date?: string; q?: string }> }) {
  await requireProfile();
  const sp = await searchParams;
  const today = todayISO();
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const q = sp.q?.trim() ?? "";
  const supabase = await createClient();

  // Search across all dates when a query is given; otherwise the chosen day's entries and exits.
  let rows;
  if (q) {
    const like = `%${q.replace(/[%,()]/g, "")}%`;
    const [{ data: byGroup }, { data: byTraveller }] = await Promise.all([
      supabase.from("travel_groups").select(SELECT).or(`group_ref.ilike.${like},partner_code.ilike.${like},label.ilike.${like},group_code.ilike.${like},guide_name.ilike.${like}`).order("travel_date", { ascending: false }).limit(100),
      supabase.from("travellers").select("travel_group_id").ilike("full_name", like).not("travel_group_id", "is", null).limit(100),
    ]);
    const ids = new Set((byTraveller ?? []).map((t) => t.travel_group_id).filter((x): x is string => !!x));
    (byGroup ?? []).forEach((g) => ids.delete(g.id));
    const { data: extra } = ids.size ? await supabase.from("travel_groups").select(SELECT).in("id", [...ids]).limit(100) : { data: [] };
    rows = [...(byGroup ?? []), ...(extra ?? [])];
  } else {
    const { data } = await supabase.from("travel_groups").select(SELECT).or(`travel_date.eq.${date},travel_end_date.eq.${date}`).order("group_code").limit(300);
    rows = data ?? [];
  }
  const list = rows.map((g) => ({
    ...g,
    ref: g.group_ref ?? groupRef(g),
    pax: g.source === "b2b" && g.pax_expected && !g.travellers.some((t) => t.status !== "cancelled") ? g.pax_expected : g.travellers.filter((t) => t.status !== "cancelled").length,
    entered: !!g.china_entry_at || ["travelling_in_china", "china_exited", "completed"].includes(g.workflow_status ?? ""),
    exited: !!g.china_exit_at || ["china_exited", "completed"].includes(g.workflow_status ?? ""),
  }));
  const entering = q ? list : list.filter((g) => g.travel_date === date);
  const exiting = q ? [] : list.filter((g) => g.travel_end_date === date);
  const stats = {
    entering: entering.length,
    enteringPax: entering.reduce((n, g) => n + g.pax, 0),
    enteredDone: entering.filter((g) => g.entered).length,
    exiting: exiting.length,
    exitingPax: exiting.reduce((n, g) => n + g.pax, 0),
    exitedDone: exiting.filter((g) => g.exited).length,
  };

  const Row = ({ g, side }: { g: (typeof list)[number]; side: "entry" | "exit" | "search" }) => (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Link href={`/travel?date=${g.travel_date}`} className="font-mono text-xs font-medium text-mr-ink hover:underline">
          {g.ref}
        </Link>
        {g.partner_code && <Chip tone="ink">{g.partner_code}</Chip>}
        <span className="text-sm text-mr-body">{g.label ?? g.travellers.find((t) => t.status !== "cancelled")?.full_name ?? ""}</span>
        <span className="tnum text-sm text-mr-body">{g.pax} pax</span>
        {g.guide_name && <span className="text-xs text-mr-muted">guide {g.guide_name}</span>}
        <span className="ml-auto flex items-center gap-1.5">
          {g.exited ? <Chip tone="success">Exited{g.china_exit_at ? ` ${formatDateTime(g.china_exit_at)}` : ""}</Chip> : g.entered ? <Chip tone="ink">In China{g.china_entry_at ? ` since ${formatDateTime(g.china_entry_at)}` : ""}</Chip> : <Chip tone="warning">{side === "exit" ? "Not marked exited" : "Not entered yet"}</Chip>}
          {g.workflow_status && <WorkflowStatusChip status={g.workflow_status} />}
        </span>
      </div>
      <p className="mt-1 text-xs text-mr-muted">
        {formatDate(g.travel_date)} to {formatDate(g.travel_end_date)} · in {g.entry_port ?? "—"} · out {g.exit_port ?? "—"}
        {g.china_entry_confirmed_by ? ` · entry by ${g.china_entry_confirmed_by}` : ""}
        {g.china_exit_confirmed_by ? ` · exit by ${g.china_exit_confirmed_by}` : ""}
      </p>
      <div className="mt-2">
        <MovementActions groupId={g.id} groupRef={g.ref} entered={g.entered} exited={g.exited} />
      </div>
    </li>
  );

  return (
    <>
      <PageHeader title="Entry / Exit" description={q ? `Search results for “${q}” across all dates` : `${formatDate(date)} · ${stats.entering} entering (${stats.enteringPax} pax) · ${stats.exiting} exiting (${stats.exitingPax} pax)`} />
      <Suspense>
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <TravelDateNav date={date} prev={toISODate(addDays(parseISO(date), -1))} next={toISODate(addDays(parseISO(date), 1))} nearby={[]} basePath="/travel/movements" />
          <SearchParamInput placeholder="Search group ID, partner, label, guide or traveller name" className="md:w-96" />
          {date !== today && !q && (
            <Link href="/travel/movements" className="text-xs font-medium text-mr-body underline">
              Today
            </Link>
          )}
        </div>
      </Suspense>

      {!q && (
        <StatGrid cols={4} className="mb-6">
          <StatCard label="Entering" value={stats.entering} hint={`${stats.enteringPax} pax · ${stats.enteredDone} confirmed`} tone={stats.entering && stats.enteredDone < stats.entering ? "warning" : "success"} />
          <StatCard label="Exiting" value={stats.exiting} hint={`${stats.exitingPax} pax · ${stats.exitedDone} confirmed`} tone={stats.exiting && stats.exitedDone < stats.exiting ? "warning" : "success"} />
          <StatCard label="Entry pending" value={stats.entering - stats.enteredDone} hint="not yet marked entered" tone={stats.entering - stats.enteredDone ? "red" : "success"} />
          <StatCard label="Exit pending" value={stats.exiting - stats.exitedDone} hint="not yet marked exited" tone={stats.exiting - stats.exitedDone ? "red" : "success"} />
        </StatGrid>
      )}

      {q ? (
        entering.length === 0 ? (
          <EmptyState icon={ArrowLeftRight} title="No group or traveller matches." />
        ) : (
          <ul className="divide-y divide-mr-line rounded-lg border border-mr-line bg-white">{entering.map((g) => <Row key={g.id} g={g} side="search" />)}</ul>
        )
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <section>
            <h2 className="mb-2 font-heading text-lg font-semibold">
              Entering China <span className="text-sm font-normal text-mr-muted">· {formatDate(date)}</span>
            </h2>
            {entering.length === 0 ? <p className="rounded-lg border border-dashed border-mr-line bg-white px-4 py-6 text-center text-sm text-mr-muted">No group enters on this day.</p> : <ul className="divide-y divide-mr-line rounded-lg border border-mr-line bg-white">{entering.map((g) => <Row key={g.id} g={g} side="entry" />)}</ul>}
          </section>
          <section>
            <h2 className="mb-2 font-heading text-lg font-semibold">
              Exiting China <span className="text-sm font-normal text-mr-muted">· {formatDate(date)}</span>
            </h2>
            {exiting.length === 0 ? <p className="rounded-lg border border-dashed border-mr-line bg-white px-4 py-6 text-center text-sm text-mr-muted">No group exits on this day.</p> : <ul className="divide-y divide-mr-line rounded-lg border border-mr-line bg-white">{exiting.map((g) => <Row key={g.id} g={g} side="exit" />)}</ul>}
          </section>
        </div>
      )}
    </>
  );
}
