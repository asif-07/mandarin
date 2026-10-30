import Link from "next/link";
import { AlertTriangle, Check, ChevronDown, Mail, MessageCircle, Phone, UserPlus } from "lucide-react";
import { Chip } from "@/components/shared/chip";
import { buttonVariants } from "@/components/ui/button";
import { ApplicationActions } from "@/components/travel/application-actions";
import { GroupSuggestions } from "@/components/travel/group-suggestions";
import { FIELD_LABELS, PORTAL_DOCS, portalDocLabel, requiredFields } from "@/lib/apply/shared";
import type { ApplicationRow } from "@/lib/queries/suggestions";
import type { Suggestion } from "@/lib/travel/suggestions";
import { PORTAL_STATUSES, labelFor } from "@/lib/constants";
import { formatDate, formatDateRange, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const SHORT: Record<string, string> = { passport: "Passport", passport_back: "Passport back", photo: "Photo", pan_card: "PAN card", par: "PAR", hotel_booking: "Hotel", flight_ticket: "Flight" };

/** What one passenger still lacks, in words. */
export function passengerMissing(p: ApplicationRow["passengers"][number], kind: ApplicationRow["kind"]): string[] {
  const present = new Set(p.doc_types);
  const docs = PORTAL_DOCS.filter((d) => d.need && !present.has(d.type)).map((d) => portalDocLabel(d.type));
  if (p.par_answer === "has_par" && !present.has("par")) docs.push("Hong Kong PAR");
  const fields = requiredFields(kind).filter((f) => !(p[f] ?? "").toString().trim()).map((f) => FIELD_LABELS[f] ?? f);
  if (!p.par_answer && !present.has("par")) fields.push("PAR question");
  return [...docs, ...fields];
}

function whatsappLink(phone: string | null, text: string): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.length >= 8 ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : null;
}

/** One application as an operations "dossier" card: header, passenger rows with document pill rails, suggestions and actions. */
export function DossierCard({ r, suggestions, origin }: { r: ApplicationRow; suggestions: Suggestion[]; origin: string }) {
  const ungrouped = r.passengers.filter((p) => !p.travel_group_id);
  const missingByPassenger = r.passengers.map((p) => ({ p, missing: passengerMissing(p, r.kind) }));
  const anyMissing = missingByPassenger.some((x) => x.missing.length > 0);
  const groupLabel = r.passengers.length > 1 ? `${r.contact_name} +${r.passengers.length - 1}` : r.contact_name;
  const link = r.token ? `${origin}/apply/t/${r.token}` : "";
  const reminder = whatsappLink(
    r.contact_phone,
    `Hello ${r.contact_name}, this is Mandarin Roots about your 144-hour China transit visa (${formatDateRange(r.travel_start_date, r.travel_end_date)}). ${anyMissing ? `Still missing: ${missingByPassenger.filter((x) => x.missing.length).map((x) => `${x.p.full_name}: ${x.missing.join(", ")}`).join("; ")}. ` : ""}Your link: ${link}`,
  );
  const status = r.status === "submitted" ? { tone: "warning" as const, label: "Submitted · needs review" } : r.status === "reviewed" ? { tone: "success" as const, label: "Reviewed" } : { tone: "muted" as const, label: labelFor(PORTAL_STATUSES, r.status) };

  return (
    <details className="group overflow-hidden rounded-xl border border-mr-line bg-white shadow-xs transition-shadow open:shadow-md hover:shadow-md" open={r.status === "submitted" && anyMissing}>
      {/* Header = the collapsed row */}
      <summary className="flex cursor-pointer list-none flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <h2 className="font-heading text-base font-semibold tracking-tight text-mr-ink">{r.contact_name}</h2>
            <span className="rounded bg-mr-surface px-2 py-0.5 font-mono text-[11px] font-semibold text-mr-ink">{formatDateRange(r.travel_start_date, r.travel_end_date)}</span>
            <span className="text-xs font-medium text-mr-body">
              {r.passengers.length} passenger{r.passengers.length === 1 ? "" : "s"}
              {r.pax && r.pax !== r.passengers.length ? ` of ${r.pax} travelling together` : r.pax ? " travelling together" : ""}
            </span>
            {r.nationality && (
              <span className="inline-flex items-center gap-1 text-xs text-mr-body">
                <span className="size-2 rounded-full bg-mr-warning" /> {r.nationality}
              </span>
            )}
            {(r.pax ?? r.passengers.length) < 2 && (
              <Chip tone="warning" icon={<UserPlus />}>
                Alone: needs a 2nd traveller
              </Chip>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-mr-body">
            {r.contact_phone && (
              <span className="inline-flex items-center gap-1">
                <Phone className="size-3 text-mr-muted" /> {r.contact_phone}
              </span>
            )}
            {r.contact_email && (
              <span className="inline-flex items-center gap-1">
                <Mail className="size-3 text-mr-muted" /> {r.contact_email}
              </span>
            )}
            <span className="text-mr-muted">{r.submitted_at ? `Submitted ${formatDateTime(r.submitted_at)}` : `Started ${formatDate(r.created_at)}`}</span>
            {r.group_ref && <span className="font-mono text-mr-muted">Group {r.group_ref}</span>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone={anyMissing ? "red" : "success"}>{anyMissing ? `Missing on ${missingByPassenger.filter((x) => x.missing.length).length} of ${r.passengers.length}` : "Documents complete"}</Chip>
          <Chip tone={status.tone}>{status.label}</Chip>
          {r.status !== "draft" && <Chip tone={r.ready ? "ink" : "neutral"}>{r.ready ? "PAR + hotel: apply directly" : "Needs PAR / hotel from us"}</Chip>}
          {r.group_ref ? <Chip tone="success">Grouped {r.passengers.length - ungrouped.length}/{r.passengers.length}</Chip> : ungrouped.length ? <Chip tone={r.status === "draft" ? "muted" : "red"}>{ungrouped.length === r.passengers.length ? "No group" : `${ungrouped.length} not grouped`}</Chip> : null}
          <ChevronDown className="size-4 text-mr-muted transition-transform group-open:rotate-180" />
        </div>
      </summary>

      {/* Passengers */}
      <div className="space-y-3 border-t border-mr-line/70 bg-mr-surface/60 px-5 py-4">
        {r.passengers.length === 0 && <p className="text-sm text-mr-muted">No passengers yet.</p>}
        {missingByPassenger.map(({ p, missing }, i) => {
          const present = new Set(p.doc_types);
          return (
            <div key={p.id} className="space-y-2.5 rounded-lg border border-mr-line bg-white p-4 shadow-xs">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-2.5">
                  <Link href={`/travel/travellers/${p.id}`} className="text-sm font-semibold text-mr-ink hover:underline">
                    {p.full_name}
                    <span className="ml-1 font-normal text-mr-muted">{i === 0 ? "(applicant)" : "(co-passenger)"}</span>
                  </Link>
                  <span className="rounded border border-mr-line bg-mr-surface px-2 py-0.5 font-mono text-[11px] font-semibold text-mr-body">{p.traveller_ref}</span>
                  {p.passport_number && (
                    <span className="font-mono text-[11px] text-mr-body">
                      Passport <strong className="text-mr-ink">{p.passport_number}</strong>
                    </span>
                  )}
                  {p.pan_number && (
                    <span className="font-mono text-[11px] text-mr-body">
                      PAN <strong className="text-mr-ink">{p.pan_number}</strong>
                    </span>
                  )}
                  {p.par_answer === "needs_par" && !present.has("par") && (
                    <Chip tone="warning" icon={<AlertTriangle />}>
                      PAR: we apply
                    </Chip>
                  )}
                  {p.group_ref && <Chip tone="success">{p.group_ref}</Chip>}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {PORTAL_DOCS.map((d) => {
                    const has = present.has(d.type);
                    const needed = d.need || (d.type === "par" && p.par_answer === "has_par");
                    return (
                      <span key={d.type} className={cn("inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-semibold", has ? "border-mr-success/30 bg-mr-success/10 text-mr-success" : needed ? "border-mr-red/30 bg-mr-red/10 text-mr-red" : "border-mr-line bg-mr-surface text-mr-muted")} title={portalDocLabel(d.type)}>
                        {has ? <Check className="size-3" /> : <span className={cn("size-1.5 rounded-full", needed ? "bg-mr-red" : "bg-mr-line")} />}
                        {SHORT[d.type] ?? portalDocLabel(d.type)}
                      </span>
                    );
                  })}
                </div>
              </div>
              {missing.length > 0 ? (
                <div className="flex items-start gap-2 rounded border border-mr-red/20 bg-mr-red/5 p-2.5 text-xs text-mr-body">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-mr-red" />
                  <div>
                    <strong className="font-semibold text-mr-red">Missing {missing.length}:</strong> {missing.join(", ")}.
                  </div>
                </div>
              ) : (
                <p className="inline-flex items-center gap-1 text-xs font-medium text-mr-success">
                  <Check className="size-3.5" /> Complete{present.has("par") && present.has("hotel_booking") ? " · PAR and hotel in" : ""}
                </p>
              )}
            </div>
          );
        })}

        {ungrouped.length > 0 && r.status !== "draft" && (
          <div>
            <p className="micro-label mb-1">Group suggestion</p>
            <GroupSuggestions travellerIds={ungrouped.map((p) => p.id)} suggestions={suggestions} label={groupLabel} />
          </div>
        )}

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <ApplicationActions applicationId={r.id} status={r.status} token={r.token} travellerId={r.passengers[0]?.id} ungroupedIds={r.status !== "draft" ? ungrouped.map((p) => p.id) : []} dates={{ travel_date: r.travel_start_date, travel_end_date: r.travel_end_date }} groupLabel={groupLabel} />
          </div>
          {reminder && (
            <a href={reminder} target="_blank" rel="noopener" className={buttonVariants({ variant: "outline", size: "sm", className: "border-mr-success/30 bg-mr-success/5 text-mr-success hover:bg-mr-success/10 hover:text-mr-success" })}>
              <MessageCircle /> {anyMissing ? "WhatsApp reminder" : "WhatsApp"}
            </a>
          )}
        </div>
      </div>
    </details>
  );
}
