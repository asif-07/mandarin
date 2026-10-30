import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { headers } from "next/headers";
import { CheckCircle2, Inbox, UserRoundX, Users } from "lucide-react";
import { EmptyState } from "@/components/shell/empty-state";
import { ClearFilters, SearchParamInput, SelectParam } from "@/components/shared/url-filters";
import { ApplyLinkButton } from "@/components/apply/apply-link-button";
import { SegmentedTabs } from "@/components/visa/segmented-tabs";
import { ExportCsvButton } from "@/components/visa/export-csv-button";
import { DossierCard, passengerMissing } from "@/components/visa/dossier-card";
import { createClient } from "@/lib/supabase/server";
import { listApplications, loadSuggestionInputs } from "@/lib/queries/suggestions";
import { suggestForTraveller } from "@/lib/travel/suggestions";
import { PORTAL_STATUSES } from "@/lib/constants";
import { format as formatDf, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Visa applications" };
export const dynamic = "force-dynamic";

const PAGE = 20;
type Search = { status?: string; q?: string; view?: string; month?: string; nat?: string; page?: string };

/** 144-hour transit visa applications: the operations console for everything that came in through the public link. */
export default async function VisaApplicationsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const origin = host ? `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")}://${host}` : "";
  const [all, inputs] = await Promise.all([listApplications(supabase, { status: sp.status, q: sp.q?.trim(), limit: 300 }), loadSuggestionInputs(supabase)]);

  // Facets from what came back, before the view / month / nationality narrowing.
  const months = [...new Set(all.map((r) => r.travel_start_date.slice(0, 7)))].sort();
  const nationalities = [...new Set(all.map((r) => r.nationality).filter((x): x is string => !!x))].sort();
  let rows = all;
  if (sp.month) rows = rows.filter((r) => r.travel_start_date.startsWith(sp.month!));
  if (sp.nat) rows = rows.filter((r) => r.nationality === sp.nat);
  const withMissing = (r: (typeof rows)[number]) => r.passengers.some((p) => passengerMissing(p, r.kind).length > 0) || r.passengers.length === 0;
  const counts = {
    all: rows.length,
    review: rows.filter((r) => r.status === "submitted").length,
    missing: rows.filter(withMissing).length,
    grouped: rows.filter((r) => r.passengers.length > 0 && r.passengers.every((p) => p.travel_group_id)).length,
  };
  const view = sp.view === "review" || sp.view === "missing" || sp.view === "grouped" ? sp.view : "all";
  if (view === "review") rows = rows.filter((r) => r.status === "submitted");
  else if (view === "missing") rows = rows.filter(withMissing);
  else if (view === "grouped") rows = rows.filter((r) => r.passengers.length > 0 && r.passengers.every((p) => p.travel_group_id));

  const submitted = all.filter((r) => r.status !== "draft");
  const stats = {
    review: all.filter((r) => r.status === "submitted").length,
    reviewToday: all.filter((r) => r.submitted_at && r.submitted_at.slice(0, 10) === new Date().toISOString().slice(0, 10)).length,
    pax: submitted.reduce((n, r) => n + r.passengers.length, 0),
    groups: submitted.length,
    ready: submitted.filter((r) => r.ready).length,
    singles: submitted.filter((r) => (r.pax ?? r.passengers.length) < 2 && r.passengers.some((p) => !p.travel_group_id)).length,
    ungrouped: submitted.filter((r) => r.passengers.some((p) => !p.travel_group_id)).length,
  };

  const page = Math.max(1, Number(sp.page) || 1);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const slice = rows.slice((page - 1) * PAGE, page * PAGE);
  const qs = (p: number) => {
    const u = new URLSearchParams();
    Object.entries({ ...sp, page: String(p) }).forEach(([k, v]) => v && u.set(k, v));
    return `/visa?${u.toString()}`;
  };

  const csv = rows.flatMap((r) =>
    (r.passengers.length ? r.passengers : [null]).map((p) => ({
      applicant: r.contact_name,
      phone: r.contact_phone,
      email: r.contact_email,
      entry: r.travel_start_date,
      exit: r.travel_end_date,
      travelling_together: r.pax,
      status: r.status,
      group: r.group_ref,
      passenger: p?.full_name,
      traveller_ref: p?.traveller_ref,
      passport_number: p?.passport_number,
      pan_number: p?.pan_number,
      nationality: p?.nationality ?? r.nationality,
      par: p?.par_answer === "needs_par" ? "we apply" : p?.par_answer === "has_par" ? "has PAR" : "",
      documents: p?.doc_types.join(" "),
      missing: p ? passengerMissing(p, r.kind).join("; ") : "no passengers",
    })),
  );

  return (
    <div className="space-y-6">
      {/* Brief + actions */}
      <div className="flex flex-col gap-4 rounded-xl border border-mr-line bg-white p-5 shadow-xs lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-4xl space-y-1.5">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-mr-ink">Visa applications</h1>
            <span className="rounded border border-mr-line bg-mr-surface px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-mr-body">144-hour transit</span>
          </div>
          <p className="text-sm leading-relaxed text-mr-body">Applications from the public link. Travellers upload for themselves and their co-passengers, or send them a personal link. Passports are read by OCR; passport front and back, photo and PAN card are needed for every passenger; the PAR question tells you who needs a PAR from us.</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <ApplyLinkButton />
          <ExportCsvButton rows={csv} />
        </div>
      </div>

      {/* Metrics */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric accent="bg-mr-red" label="Submitted / in review" value={stats.review} aside={stats.reviewToday ? `+${stats.reviewToday} today` : undefined} asideClass="text-mr-red" hint="Applications waiting for a check" pulse={stats.review > 0} />
        <Metric accent="bg-mr-ink" label="Passengers" value={stats.pax} aside={`across ${stats.groups} application${stats.groups === 1 ? "" : "s"}`} hint="In submitted applications" icon={<Users className="size-4 text-mr-muted" />} />
        <Metric accent="bg-mr-success" label="Can apply directly" value={stats.ready} aside="ready to lodge" asideClass="text-mr-success" hint="PAR and hotel in for every passenger" icon={<CheckCircle2 className="size-4 text-mr-success" />} />
        <Metric accent="bg-mr-warning" label="Not grouped / action" value={stats.ungrouped} aside={stats.singles ? `${stats.singles} travelling alone` : undefined} asideClass="rounded bg-mr-warning/10 px-1.5 py-0.5 text-mr-warning" hint="Passengers still to place in a group" icon={<UserRoundX className="size-4 text-mr-warning" />} />
      </section>

      {/* Filter hub */}
      <Suspense>
        <div className="space-y-3 rounded-xl border border-mr-line bg-white p-4 shadow-xs">
          <div className="flex flex-col items-stretch justify-between gap-3 lg:flex-row lg:items-center">
            <SearchParamInput placeholder="Search applicant, phone, email" className="lg:max-w-xl lg:flex-1" />
            <SegmentedTabs
              active={view}
              tabs={[
                { value: "all", label: "All applications", count: counts.all },
                { value: "review", label: "Needs review", count: counts.review, tone: "warning" },
                { value: "missing", label: "Missing docs", count: counts.missing, tone: "red" },
                { value: "grouped", label: "Grouped", count: counts.grouped, tone: "success" },
              ]}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-mr-line/70 pt-3 text-xs">
            <SelectParam name="status" placeholder="Status: all" allLabel="All statuses" options={PORTAL_STATUSES.map((s) => ({ value: s.value, label: s.label }))} />
            <SelectParam name="month" placeholder="Travel: any month" allLabel="Any month" options={months.map((m) => ({ value: m, label: formatDf(parseISO(`${m}-01`), "MMM yyyy") }))} />
            <SelectParam name="nat" placeholder="Nationality: all" allLabel="All nationalities" options={nationalities.map((n) => ({ value: n, label: n }))} />
            <ClearFilters keys={["q", "status", "month", "nat", "view"]} />
            <span className="ml-auto text-mr-muted">
              {rows.length} application{rows.length === 1 ? "" : "s"} · {rows.reduce((n, r) => n + r.passengers.length, 0)} passengers
            </span>
          </div>
        </div>
      </Suspense>

      {/* Dossiers */}
      {slice.length === 0 ? (
        <EmptyState icon={Inbox} title={sp.q || sp.status || sp.month || sp.nat || view !== "all" ? "No applications match these filters." : "No applications yet. Share the link with travellers."} action={!sp.q && !sp.status && view === "all" && <ApplyLinkButton />} />
      ) : (
        <div className="space-y-4">
          {slice.map((r) => {
            const ungrouped = r.passengers.filter((p) => !p.travel_group_id);
            const suggestions = ungrouped.length && r.status !== "draft" ? suggestForTraveller({ id: r.id, full_name: r.contact_name, traveller_ref: r.id, travel_start_date: r.travel_start_date, travel_end_date: r.travel_end_date, application_id: r.id }, inputs.groups, inputs.ungrouped.filter((t) => t.application_id !== r.id)) : [];
            return <DossierCard key={r.id} r={r} suggestions={suggestions} origin={origin} />;
          })}
        </div>
      )}

      {/* Pagination strip */}
      <div className="flex flex-col items-center justify-between gap-3 border-t border-mr-line/70 pt-4 text-xs text-mr-body sm:flex-row">
        <div className="flex items-center gap-2 font-mono text-[11px]">
          <span className="size-2 rounded-full bg-mr-success" />
          <span>Passport reader: in the traveller&apos;s browser · PAN read from the card</span>
          <span className="text-mr-line">|</span>
          <span>
            Next trips: {months.length ? months.slice(0, 3).map((m) => formatDf(parseISO(`${m}-01`), "MMM")).join(", ") : "none"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="mr-2 text-mr-muted">
            Showing {rows.length === 0 ? 0 : (page - 1) * PAGE + 1}–{Math.min(page * PAGE, rows.length)} of {rows.length}
          </span>
          <PageLink href={qs(page - 1)} disabled={page <= 1}>
            Previous
          </PageLink>
          {Array.from({ length: pages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === pages || Math.abs(p - page) <= 1)
            .map((p) => (
              <PageLink key={p} href={qs(p)} active={p === page}>
                {p}
              </PageLink>
            ))}
          <PageLink href={qs(page + 1)} disabled={page >= pages}>
            Next
          </PageLink>
        </div>
      </div>
    </div>
  );
}

function Metric({ accent, label, value, aside, asideClass, hint, icon, pulse }: { accent: string; label: string; value: number; aside?: string; asideClass?: string; hint: string; icon?: React.ReactNode; pulse?: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-mr-line bg-white p-4 shadow-xs transition-shadow hover:shadow-md">
      <div className={cn("absolute inset-y-0 left-0 w-1", accent)} />
      <div className="mb-2 flex items-start justify-between">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-mr-body">{label}</span>
        {pulse ? (
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-mr-red opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-mr-red" />
          </span>
        ) : (
          icon
        )}
      </div>
      <div className="flex items-baseline gap-2.5">
        <span className="tnum font-heading text-3xl font-bold tracking-tight text-mr-ink">{value}</span>
        {aside && <span className={cn("text-xs font-medium text-mr-body", asideClass)}>{aside}</span>}
      </div>
      <p className="mt-1 text-xs text-mr-muted">{hint}</p>
    </div>
  );
}

function PageLink({ href, children, active, disabled }: { href: string; children: React.ReactNode; active?: boolean; disabled?: boolean }) {
  const cls = cn("rounded px-2.5 py-1 text-xs font-medium", active ? "bg-mr-red text-white" : "border border-mr-line bg-white text-mr-body hover:bg-mr-surface", disabled && "pointer-events-none opacity-40");
  return disabled ? (
    <span className={cls}>{children}</span>
  ) : (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}
