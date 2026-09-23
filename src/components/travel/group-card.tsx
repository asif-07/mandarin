import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, Download, FileText, Plane, Users } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Chip } from "@/components/shared/chip";
import { StatusPill, TRAVELLER_TONES } from "@/components/shared/status-pill";
import { StopToggle } from "@/components/shared/stop-toggle";
import { DocsBadge, PackageBadge } from "@/components/travel/traveller-table";
import { CompileGroupButton } from "@/components/travel/pack-panel";
import { GroupRowActions } from "@/components/travel/groups-manager";
import { RemoveFromGroupButton } from "@/components/travel/remove-from-group-button";
import { GroupDocuments, type GroupDocView } from "@/components/travel/group-documents";
import { GroupVisaPanel } from "@/components/travel/group-visa";
import { MarkPaidButton } from "@/components/invoices/mark-paid-button";
import { INVOICE_STATUSES, TRAVELLER_STATUSES, labelFor, packageDetail } from "@/lib/constants";
import { docCompleteness, groupCoverage, groupPackReference, groupRef, type DocStub } from "@/lib/queries/travel";
import { groupInvoiceState, groupIssues, groupPax, groupTiming, type Balance } from "@/lib/queries/group-status";
import { formatDateRange, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

export type GroupCardGroup = {
  id: string;
  travel_date: string;
  travel_end_date: string;
  group_code: string;
  label: string | null;
  guide_name: string | null;
  notes: string | null;
  reference_prefix: string;
  entry_port: string | null;
  exit_port: string | null;
  source: string;
  partner_code: string | null;
  partner_reference?: string | null;
  pax_expected: number | null;
  pack_path: string | null;
  package_tier: string | null;
  hotel_name: string | null;
  hotel_stars: number | null;
  transit_location: string | null;
  visa_status: string;
  visa_applied_at: string | null;
  visa_uploaded_at: string | null;
  visa_path: string | null;
  group_ref: string | null;
  invoices: { id: string; invoice_number: string; total: number | string; currency: string; status: string }[];
  group_documents: (GroupDocView & { deleted_at: string | null })[];
  travellers: { id: string; full_name: string; status: string; package_tier: string | null; passport_number: string | null; visa_reference: string | null; traveller_documents: DocStub[] }[];
};

const TIMING_TONE = { now: "ink", soon: "warning", later: "neutral", past: "muted" } as const;

/**
 * One group, collapsed to a header that answers "what is this group and what
 * is still outstanding", expanding to travellers, group documents, visa,
 * invoices and actions. Used by the Travel and B2B pages so both look the same.
 */
export function GroupCard({ g, balances, partnerHasLogo, defaultOpen = false, extra }: { g: GroupCardGroup; balances: Map<string, Balance>; partnerHasLogo: boolean; defaultOpen?: boolean; extra?: ReactNode }) {
  const travellers = [...g.travellers].filter((t) => t.status !== "cancelled").sort((a, b) => a.full_name.localeCompare(b.full_name));
  const groupDocs = g.group_documents.filter((d) => !d.deleted_at);
  const coverage = groupCoverage(groupDocs);
  const complete = travellers.filter((t) => docCompleteness(t.traveller_documents, coverage).complete).length;
  const issues = groupIssues(g, balances);
  const timing = groupTiming(g);
  const invoice = groupInvoiceState(g, balances);
  const pax = groupPax(g);
  const isB2b = g.source === "b2b";
  const liveInvoices = g.invoices.filter((i) => i.status !== "cancelled");
  const balanceOf = (i: (typeof liveInvoices)[number]) => balances.get(i.id)?.balance ?? Number(i.total);
  // What to call the group: its label, else the note, else the first traveller (partner packs fall back to partner + pax).
  const notes = g.notes?.trim() || null;
  const firstTraveller = travellers[0]?.full_name ?? null;
  const title = g.label ?? notes ?? (isB2b ? `${g.partner_code} · ${g.pax_expected ?? pax} pax` : firstTraveller ? `${firstTraveller}${travellers.length > 1 ? ` +${travellers.length - 1}` : ""}` : "No label");
  const subtitle = g.label && notes ? notes : null;

  return (
    <details className={cn("group rounded-lg border bg-white shadow-sm open:border-mr-ink", timing.tone === "now" ? "border-mr-ink" : "border-mr-line")} open={defaultOpen}>
      <summary className="cursor-pointer list-none px-4 pt-3 pb-3 [&::-webkit-details-marker]:hidden">
        {/* Row 1: identity and actions */}
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 flex-col items-center justify-center rounded-md bg-mr-surface font-heading text-base font-semibold leading-none text-mr-ink">
            {g.group_code}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {g.partner_code && (
                <Chip tone="ink" title={isB2b ? "Partner compiled the pack" : "Our group for this partner"}>
                  {isB2b ? "B2B" : "Partner"} {g.partner_code}
                </Chip>
              )}
              <span className={cn("truncate text-sm font-medium", title === "No label" ? "text-mr-muted" : "text-mr-ink")} title={title}>
                {title}
              </span>
              {g.guide_name && <span className="truncate text-xs text-mr-muted">Guide {g.guide_name}</span>}
              {subtitle && (
                <span className="w-full truncate text-xs text-mr-body" title={subtitle}>
                  {subtitle}
                </span>
              )}
            </div>
            <p className="tnum mt-0.5 truncate text-xs text-mr-body">
              {formatDateRange(g.travel_date, g.travel_end_date)} · <span className="font-mono">{g.group_ref ?? groupRef(g)}</span>
            </p>
            <p className="truncate text-xs text-mr-muted">
              {g.entry_port && g.exit_port ? `In ${g.entry_port} · Out ${g.exit_port}` : "Ports not set"}
              {g.package_tier ? ` · ${packageDetail(g.package_tier, g.hotel_stars, g.hotel_name, g.transit_location)}` : ""}
            </p>
          </div>
          <StopToggle className="flex shrink-0 items-center gap-1">
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
        </div>
        {/* Row 2: the four things that matter, plus what is outstanding */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Chip tone={TIMING_TONE[timing.tone]} icon={<Plane />}>{timing.text}</Chip>
          <Chip tone="neutral" icon={<Users />}>{pax} pax</Chip>
          {!isB2b && (
            <Chip tone={travellers.length && complete === travellers.length ? "success" : "warning"} icon={<FileText />}>
              Docs {complete}/{travellers.length}
            </Chip>
          )}
          <Chip tone={g.visa_status === "approved" ? "success" : g.visa_status === "applied" ? "warning" : "neutral"}>
            {g.visa_status === "approved" ? "Visa received" : g.visa_status === "applied" ? "Visa applied" : "Visa not applied"}
          </Chip>
          <Chip tone={invoice.tone}>{invoice.label}</Chip>
          {issues.length === 0 ? (
            <Chip tone="success" icon={<CheckCircle2 />}>Ready</Chip>
          ) : (
            <Chip tone={issues.some((i) => i.tone === "red") ? "red" : "warning"} icon={<AlertTriangle />}>
              {issues.length} to do
            </Chip>
          )}
          <ChevronDown className="ml-auto size-4 shrink-0 text-mr-muted transition-transform group-open:rotate-180" aria-hidden />
        </div>
      </summary>

      <div className="space-y-4 border-t border-mr-line px-4 py-4">
        {/* To do */}
        {issues.length > 0 && (
          <div className="rounded-md border border-mr-line bg-mr-surface/60 p-3">
            <p className="micro-label mb-2">To do</p>
            <ul className="space-y-1.5 text-sm">
              {issues.map((i) => (
                <li key={i.key + i.text} className="flex flex-wrap items-center gap-2">
                  <span className={cn("size-1.5 shrink-0 rounded-full", i.tone === "red" ? "bg-mr-red" : i.tone === "warning" ? "bg-mr-warning" : "bg-mr-muted")} aria-hidden />
                  <span className="text-mr-ink">{i.text}</span>
                  {i.key === "invoice" && (
                    <Link href={`/invoices/new?group=${g.id}`} className="text-xs font-medium text-mr-body hover:text-mr-ink hover:underline">
                      Create invoice
                    </Link>
                  )}
                  {i.key === "travellers" && (
                    <Link href={`/travel/travellers/new?group=${g.id}`} className="text-xs font-medium text-mr-body hover:text-mr-ink hover:underline">
                      Add traveller
                    </Link>
                  )}
                  {i.key === "pack" && (
                    <Link href="/travel/b2b" className="text-xs font-medium text-mr-body hover:text-mr-ink hover:underline">
                      Upload on the B2B page
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Travellers */}
        {isB2b && travellers.length === 0 ? (
          <p className="text-sm text-mr-muted">
            {g.partner_code} compiled this pack themselves ({g.pax_expected ?? 0} pax). Individual travellers are not tracked here.
          </p>
        ) : travellers.length === 0 ? null : (
          <div>
            <p className="micro-label mb-1">Travellers</p>
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
                        {!c.complete && c.missingLabels.length ? ` · missing ${c.missingLabels.join(", ")}` : ""}
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
          </div>
        )}

        {extra}

        <GroupDocuments groupId={g.id} documents={groupDocs} />

        <div>
          <p className="micro-label mb-1">Visa</p>
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
              partner_has_logo: partnerHasLogo,
            }}
          />
        </div>

        {/* Invoices */}
        <div>
          <p className="micro-label mb-1">Invoice</p>
          {liveInvoices.length ? (
            <ul className="space-y-1 text-sm">
              {liveInvoices.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center gap-2">
                  <Link href={`/invoices/${i.id}`} className="font-medium text-mr-ink hover:underline">
                    {i.invoice_number}
                  </Link>
                  <span className="tnum text-mr-body">{formatMoney(i.total, i.currency)}</span>
                  <Chip tone={i.status === "paid" || (i.status === "issued" && balanceOf(i) <= 0) ? "success" : i.status === "issued" ? "warning" : "neutral"}>
                    {i.status === "paid" || (i.status === "issued" && balanceOf(i) <= 0) ? "Paid" : i.status === "issued" ? `Unpaid · ${formatMoney(balanceOf(i), i.currency)} due` : labelFor(INVOICE_STATUSES, i.status)}
                  </Chip>
                  {i.status === "issued" && balanceOf(i) > 0 && <MarkPaidButton invoiceId={i.id} invoiceNumber={i.invoice_number} balance={balanceOf(i)} currency={i.currency} />}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-mr-muted">
              None yet.{" "}
              <Link href={`/invoices/new?group=${g.id}`} className="font-medium text-mr-body hover:text-mr-ink hover:underline">
                Create invoice
              </Link>
            </p>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-mr-line pt-3">
          <span className="flex flex-wrap items-center gap-3 text-xs">
            <Link href={`/travel/travellers/new?group=${g.id}`} className="font-medium text-mr-body hover:text-mr-ink hover:underline">
              + Add traveller
            </Link>
            <Link href={`/invoices/new?group=${g.id}`} className="font-medium text-mr-body hover:text-mr-ink hover:underline">
              + Create invoice
            </Link>
            <span className="font-mono text-mr-muted">{groupPackReference(g, pax)}.pdf</span>
          </span>
          {isB2b ? (
            g.pack_path ? (
              <a href={`/api/groups/${g.id}/bundle`} className={buttonVariants({ size: "sm" })}>
                <Download /> Download pack
              </a>
            ) : (
              <Link href="/travel/b2b" className={buttonVariants({ variant: "outline", size: "sm" })}>
                Upload the partner pack
              </Link>
            )
          ) : (
            <CompileGroupButton groupId={g.id} travellerCount={travellers.length} />
          )}
        </div>
      </div>
    </details>
  );
}
