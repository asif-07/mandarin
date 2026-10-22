import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Inbox } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";
import { StatCard, StatGrid } from "@/components/shared/stat-card";
import { Chip } from "@/components/shared/chip";
import { ClearFilters, SearchParamInput, SelectParam } from "@/components/shared/url-filters";
import { StatusPill, TRAVELLER_TONES } from "@/components/shared/status-pill";
import { ApplyLinkButton } from "@/components/apply/apply-link-button";
import { ApplicationActions } from "@/components/travel/application-actions";
import { GroupSuggestions } from "@/components/travel/group-suggestions";
import { createClient } from "@/lib/supabase/server";
import { listApplications, loadSuggestionInputs } from "@/lib/queries/suggestions";
import { suggestForTraveller } from "@/lib/travel/suggestions";
import { PORTAL_DOCS, portalDocLabel } from "@/lib/apply/shared";
import { PORTAL_STATUSES, TRAVELLER_STATUSES, labelFor } from "@/lib/constants";
import { formatDate, formatDateRange, formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Customer applications" };
export const dynamic = "force-dynamic";

/** B2C applications from the public /apply link: what came in, what is missing, and which group each customer could join. */
export default async function ApplicationsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const [rows, inputs] = await Promise.all([listApplications(supabase, { status: sp.status, q: sp.q?.trim() }), loadSuggestionInputs(supabase)]);
  const stats = {
    submitted: rows.filter((r) => r.portal_status === "submitted").length,
    drafts: rows.filter((r) => r.portal_status === "draft").length,
    ready: rows.filter((r) => r.portal_ready && r.portal_status !== "draft").length,
    ungrouped: rows.filter((r) => !r.travel_group_id && r.portal_status !== "draft").length,
  };

  return (
    <>
      <PageHeader title="Customer applications" description="Individual travellers who applied through the public link. Passport read by OCR, photo and PAN card uploaded; PAR and hotel when they have them. Group them with the suggestions below: the China group visa needs at least two travellers." actions={<ApplyLinkButton />} />
      <Suspense>
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <SearchParamInput placeholder="Search name, reference, passport, phone" className="md:w-80" />
          <SelectParam name="status" placeholder="All states" options={PORTAL_STATUSES.map((s) => ({ value: s.value, label: s.label }))} />
          <ClearFilters keys={["q", "status"]} />
        </div>
      </Suspense>
      <StatGrid cols={4} className="mb-6">
        <StatCard label="Submitted" value={stats.submitted} hint="waiting for review" tone={stats.submitted ? "warning" : "success"} />
        <StatCard label="Can apply directly" value={stats.ready} hint="PAR and hotel uploaded" tone="ink" />
        <StatCard label="Not grouped" value={stats.ungrouped} hint="submitted, no group yet" tone={stats.ungrouped ? "red" : "success"} />
        <StatCard label="Started, not submitted" value={stats.drafts} hint="customer still uploading" tone="neutral" />
      </StatGrid>

      {rows.length === 0 ? (
        <EmptyState icon={Inbox} title={sp.q || sp.status ? "No applications match." : "No customer applications yet. Share the link with individual travellers."} action={!sp.q && !sp.status && <ApplyLinkButton />} />
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const present = new Set(r.doc_types);
            const missing = PORTAL_DOCS.filter((d) => d.need && !present.has(d.type)).map((d) => d.title);
            const suggestions = !r.travel_group_id && r.portal_status !== "draft" ? suggestForTraveller({ id: r.id, full_name: r.full_name, traveller_ref: r.traveller_ref, travel_start_date: r.travel_start_date, travel_end_date: r.travel_end_date }, inputs.groups, inputs.ungrouped) : [];
            return (
              <li key={r.id} className="rounded-lg border border-mr-line bg-white p-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Link href={`/travel/travellers/${r.id}`} className="font-medium text-mr-ink hover:underline">
                    {r.full_name}
                  </Link>
                  <span className="font-mono text-xs text-mr-muted">{r.traveller_ref}</span>
                  <span className="tnum text-sm text-mr-body">{formatDateRange(r.travel_start_date, r.travel_end_date)}</span>
                  {r.nationality && <span className="text-xs text-mr-muted">{r.nationality}</span>}
                  <span className="ml-auto flex flex-wrap items-center gap-1.5">
                    <Chip tone={r.portal_status === "submitted" ? "warning" : r.portal_status === "reviewed" ? "success" : "muted"}>{labelFor(PORTAL_STATUSES, r.portal_status ?? "draft")}</Chip>
                    {r.portal_status !== "draft" && <Chip tone={r.portal_ready ? "ink" : "neutral"}>{r.portal_ready ? "Has PAR + hotel: apply directly" : "Needs PAR / hotel from us"}</Chip>}
                    {r.group_ref ? (
                      <Chip tone="success">Group {r.group_ref}</Chip>
                    ) : (
                      <Chip tone={r.portal_status === "draft" ? "muted" : "red"}>No group</Chip>
                    )}
                    <StatusPill label={labelFor(TRAVELLER_STATUSES, r.status)} tone={TRAVELLER_TONES[r.status]} />
                  </span>
                </div>
                <p className="mt-1 text-xs text-mr-muted">
                  {r.phone ?? "no phone"}
                  {r.email ? ` · ${r.email}` : ""}
                  {r.passport_number ? ` · passport ${r.passport_number}` : " · passport number missing"}
                  {r.pan_number ? ` · PAN ${r.pan_number}` : " · PAN number missing"}
                  {r.address ? "" : " · address missing"}
                  {r.portal_submitted_at ? ` · submitted ${formatDateTime(r.portal_submitted_at)}` : r.created_at ? ` · started ${formatDate(r.created_at)}` : ""}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {PORTAL_DOCS.map((d) => (
                    <Chip key={d.type} tone={present.has(d.type) ? "success" : d.need ? "red" : "muted"}>
                      {portalDocLabel(d.type)}
                      {present.has(d.type) ? "" : d.need ? " missing" : " —"}
                    </Chip>
                  ))}
                  {present.has("other") && <Chip tone="neutral">Other</Chip>}
                </div>
                {suggestions.length > 0 || (!r.travel_group_id && r.portal_status !== "draft") ? (
                  <div className="mt-3">
                    <p className="micro-label mb-1">Group suggestion</p>
                    <GroupSuggestions travellerId={r.id} suggestions={suggestions} />
                  </div>
                ) : null}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <ApplicationActions travellerId={r.id} portalStatus={r.portal_status} token={r.portal_token} missing={missing} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
