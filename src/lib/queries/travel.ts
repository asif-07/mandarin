import { DOC_TYPES, REQUIRED_DOC_TYPES, labelFor } from "@/lib/constants";
import { formatDateRange, formatMonthDay } from "@/lib/format";

export type DocStub = { doc_type: string; deleted_at: string | null };

/** Required-document completeness for a traveller from its (possibly soft-deleted) document rows. */
export function docCompleteness(docs: DocStub[] | null | undefined) {
  const present = new Set((docs ?? []).filter((d) => !d.deleted_at).map((d) => d.doc_type));
  const missing = REQUIRED_DOC_TYPES.filter((t) => !present.has(t));
  return {
    count: REQUIRED_DOC_TYPES.length - missing.length,
    total: REQUIRED_DOC_TYPES.length,
    complete: missing.length === 0,
    missing,
    missingLabels: missing.map((m) => labelFor(DOC_TYPES, m)),
  };
}

export type GroupLike = {
  travel_date: string;
  travel_end_date?: string | null;
  group_code: string;
  label?: string | null;
  reference_prefix?: string | null;
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
  const prefix = (g.reference_prefix || "MR144").toUpperCase();
  const start = formatMonthDay(g.travel_date);
  const end = formatMonthDay(g.travel_end_date ?? g.travel_date);
  return `${prefix}-${start}-${end}-${String(pax).padStart(2, "0")}px-${g.group_code}`;
}
