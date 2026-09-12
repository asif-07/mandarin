import { DOC_TYPES, REQUIRED_DOC_TYPES, labelFor } from "@/lib/constants";
import { formatDateRange, formatMonthDay } from "@/lib/format";
import { b2bReference } from "@/lib/travel/b2b-code";

export type DocStub = { doc_type: string; deleted_at: string | null };

/** Active group-level document types from (possibly soft-deleted) group_documents rows. */
export function groupCoverage(groupDocs: DocStub[] | null | undefined): Set<string> {
  return new Set((groupDocs ?? []).filter((d) => !d.deleted_at).map((d) => d.doc_type));
}

/**
 * Required-document completeness for a traveller from its (possibly
 * soft-deleted) document rows. A flight ticket or hotel booking uploaded once
 * at group level counts for every traveller in that group; PAR and passport
 * are always per traveller.
 */
export function docCompleteness(docs: DocStub[] | null | undefined, groupDocs?: DocStub[] | Set<string> | null) {
  const present = new Set((docs ?? []).filter((d) => !d.deleted_at).map((d) => d.doc_type));
  const covered = groupDocs instanceof Set ? groupDocs : groupCoverage(groupDocs);
  const coveredByGroup = REQUIRED_DOC_TYPES.filter((t) => !present.has(t) && covered.has(t));
  const missing = REQUIRED_DOC_TYPES.filter((t) => !present.has(t) && !covered.has(t));
  return {
    count: REQUIRED_DOC_TYPES.length - missing.length,
    total: REQUIRED_DOC_TYPES.length,
    complete: missing.length === 0,
    missing,
    missingLabels: missing.map((m) => labelFor(DOC_TYPES, m)),
    coveredByGroup,
  };
}

export type GroupLike = {
  travel_date: string;
  travel_end_date?: string | null;
  group_code: string;
  label?: string | null;
  reference_prefix?: string | null;
  source?: string | null;
  partner_code?: string | null;
  pax_expected?: number | null;
};

/** "15–20 Oct 2026 · G03" (+ label) */
export function groupTitle(g: GroupLike | null | undefined) {
  if (!g) return "";
  const parts = [formatDateRange(g.travel_date, g.travel_end_date ?? g.travel_date), g.group_code];
  if (g.label) parts.push(g.label);
  return parts.join(" · ");
}

/**
 * Reference used to name the merged group PDF, in the format the team uses:
 *   MR144-Aug25-Aug30-05px-G01
 *   prefix - start - end - pax count - group code
 */
export function groupPackReference(g: GroupLike, pax: number): string {
  if (g.source === "b2b" && g.partner_code) {
    // Partner groups keep the partner's own code shape: MR144-EDPT-OCT15-OCT20-100PX-G03
    return b2bReference(
      { reference_prefix: g.reference_prefix, partner_code: g.partner_code, travel_date: g.travel_date, travel_end_date: g.travel_end_date ?? g.travel_date, group_code: g.group_code },
      g.pax_expected ?? pax,
    );
  }
  const prefix = (g.reference_prefix || "MR144").toUpperCase();
  const start = formatMonthDay(g.travel_date);
  const end = formatMonthDay(g.travel_end_date ?? g.travel_date);
  return `${prefix}-${start}-${end}-${String(pax).padStart(2, "0")}px-${g.group_code}`;
}
