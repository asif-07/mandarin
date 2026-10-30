import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Inbox } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";
import { StatCard, StatGrid } from "@/components/shared/stat-card";
import { Chip } from "@/components/shared/chip";
import { ClearFilters, SearchParamInput, SelectParam } from "@/components/shared/url-filters";
import { ApplyLinkButton } from "@/components/apply/apply-link-button";
import { ApplicationActions } from "@/components/travel/application-actions";
import { GroupSuggestions } from "@/components/travel/group-suggestions";
import { createClient } from "@/lib/supabase/server";
import { listApplications, loadSuggestionInputs } from "@/lib/queries/suggestions";
import { suggestForTraveller } from "@/lib/travel/suggestions";
import { PORTAL_DOCS, portalDocLabel, requiredFields, FIELD_LABELS } from "@/lib/apply/shared";
import { PORTAL_STATUSES, labelFor } from "@/lib/constants";
import { formatDate, formatDateRange, formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Visa applications" };
export const dynamic = "force-dynamic";

/** Documents received through the public /apply link: customers (with co-passengers) and travel agents (bulk). What is missing, and which group to put them in. */
export default async function ApplicationsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const [rows, inputs] = await Promise.all([listApplications(supabase, { status: sp.status, q: sp.q?.trim() }), loadSuggestionInputs(supabase)]);
  const stats = {
    submitted: rows.filter((r) => r.status === "submitted").length,
    pax: rows.filter((r) => r.status !== "draft").reduce((n, r) => n + r.passengers.length, 0),
    ready: rows.filter((r) => r.ready && r.status !== "draft").length,
    ungrouped: rows.filter((r) => r.status !== "draft" && r.passengers.some((p) => !p.travel_group_id)).length,
  };

  return (
    <>
      <PageHeader title="Visa applications" description="144-hour transit visa applications from the public link. Travellers upload for themselves and their co-passengers (or send them a personal link). Passports are read by OCR; passport front and back, photo and PAN card are needed for every passenger; the PAR question tells you who needs a PAR from us." actions={<ApplyLinkButton />} />
      <Suspense>
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <SearchParamInput placeholder="Search contact, agency, phone, email" className="md:w-80" />
          <SelectParam name="status" placeholder="All states" options={PORTAL_STATUSES.map((s) => ({ value: s.value, label: s.label }))} />
          <ClearFilters keys={["q", "status"]} />
        </div>
      </Suspense>
      <StatGrid cols={4} className="mb-6">
        <StatCard label="Submitted" value={stats.submitted} hint="waiting for review" tone={stats.submitted ? "warning" : "success"} />
        <StatCard label="Passengers" value={stats.pax} hint="in submitted applications" tone="ink" />
        <StatCard label="Can apply directly" value={stats.ready} hint="PAR and hotel for everyone" tone="neutral" />
        <StatCard label="Not grouped" value={stats.ungrouped} hint="applications with ungrouped passengers" tone={stats.ungrouped ? "red" : "success"} />
      </StatGrid>

      {rows.length === 0 ? (
        <EmptyState icon={Inbox} title={sp.q || sp.status ? "No applications match." : "No applications yet. Share the link with travellers."} action={!sp.q && !sp.status && <ApplyLinkButton />} />
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const ungrouped = r.passengers.filter((p) => !p.travel_group_id);
            const suggestions = ungrouped.length && r.status !== "draft" ? suggestForTraveller({ id: r.id, full_name: r.contact_name, traveller_ref: r.id, travel_start_date: r.travel_start_date, travel_end_date: r.travel_end_date, application_id: r.id }, inputs.groups, inputs.ungrouped.filter((t) => t.application_id !== r.id)) : [];
            const fields = requiredFields(r.kind);
            const groupLabel = r.passengers.length > 1 ? `${r.contact_name} +${r.passengers.length - 1}` : r.contact_name;
            return (
              <li key={r.id} className="rounded-lg border border-mr-line bg-white p-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-medium text-mr-ink">{r.contact_name}</span>
                  <span className="tnum text-sm text-mr-body">{formatDateRange(r.travel_start_date, r.travel_end_date)}</span>
                  <span className="text-sm text-mr-body">
                    {r.passengers.length} passenger{r.passengers.length === 1 ? "" : "s"}
                    {r.pax && r.pax !== r.passengers.length ? ` of ${r.pax} travelling together` : ""}
                    {r.nationality ? ` · ${r.nationality}` : ""}
                  </span>
                  {(r.pax ?? r.passengers.length) < 2 && <Chip tone="warning">Alone: needs a 2nd traveller</Chip>}
                  <span className="ml-auto flex flex-wrap items-center gap-1.5">
                    <Chip tone={r.status === "submitted" ? "warning" : r.status === "reviewed" ? "success" : "muted"}>{labelFor(PORTAL_STATUSES, r.status)}</Chip>
                    {r.status !== "draft" && <Chip tone={r.ready ? "ink" : "neutral"}>{r.ready ? "PAR + hotel for all: apply directly" : "Needs PAR / hotel from us"}</Chip>}
                    {r.group_ref ? <Chip tone="success">Group {r.group_ref}</Chip> : ungrouped.length ? <Chip tone={r.status === "draft" ? "muted" : "red"}>{ungrouped.length === r.passengers.length ? "No group" : `${ungrouped.length} not grouped`}</Chip> : r.passengers.length ? <Chip tone="success">Grouped</Chip> : null}
                  </span>
                </div>
                <p className="mt-1 text-xs text-mr-muted">
                  {r.contact_phone ?? "no phone"}
                  {r.contact_email ? ` · ${r.contact_email}` : ""}
                  {r.submitted_at ? ` · submitted ${formatDateTime(r.submitted_at)}` : ` · started ${formatDate(r.created_at)}`}
                </p>

                {r.passengers.length > 0 && (
                  <ul className="mt-3 divide-y divide-mr-line rounded-md border border-mr-line">
                    {r.passengers.map((p) => {
                      const present = new Set(p.doc_types);
                      const missingDocs = PORTAL_DOCS.filter((d) => d.need && !present.has(d.type)).map((d) => portalDocLabel(d.type));
                      const missingFields = fields.filter((f) => !(p[f] ?? "").toString().trim()).map((f) => FIELD_LABELS[f] ?? f);
                      const missing = [...missingDocs, ...missingFields];
                      return (
                        <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                          <Link href={`/travel/travellers/${p.id}`} className="font-medium text-mr-ink hover:underline">
                            {p.full_name}
                          </Link>
                          <span className="font-mono text-xs text-mr-muted">{p.traveller_ref}</span>
                          {p.passport_number && <span className="font-mono text-xs text-mr-body">{p.passport_number}</span>}
                          {p.pan_number && <span className="font-mono text-xs text-mr-body">PAN {p.pan_number}</span>}
                          {p.par_answer === "needs_par" && !p.doc_types.includes("par") && <Chip tone="warning">PAR: we apply</Chip>}
                          <span className="ml-auto flex flex-wrap items-center gap-1">
                            {PORTAL_DOCS.map((d) => (
                              <Chip key={d.type} tone={present.has(d.type) ? "success" : d.need ? "red" : "muted"} title={portalDocLabel(d.type)}>
                                {portalDocLabel(d.type).replace("Passport front (data page)", "Passport").replace("Passport back (address page)", "Passport back").replace("Passport-size photo", "Photo").replace("Hong Kong PAR", "PAR").replace("Hotel booking", "Hotel").replace("Flight ticket", "Flight")}
                              </Chip>
                            ))}
                            {p.group_ref && <Chip tone="success">{p.group_ref}</Chip>}
                          </span>
                          {missing.length > 0 && <span className="basis-full text-xs text-mr-warning">Missing: {missing.join(", ")}</span>}
                        </li>
                      );
                    })}
                  </ul>
                )}

                {ungrouped.length > 0 && r.status !== "draft" && (
                  <div className="mt-3">
                    <p className="micro-label mb-1">Group suggestion</p>
                    <GroupSuggestions travellerIds={ungrouped.map((p) => p.id)} suggestions={suggestions} label={groupLabel} />
                  </div>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <ApplicationActions applicationId={r.id} status={r.status} token={r.token} travellerId={r.passengers[0]?.id} ungroupedIds={r.status !== "draft" ? ungrouped.map((p) => p.id) : []} dates={{ travel_date: r.travel_start_date, travel_end_date: r.travel_end_date }} groupLabel={groupLabel} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
