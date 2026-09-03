import { DOC_TYPES, REQUIRED_DOC_TYPES, labelFor } from "@/lib/constants";
import { formatDate } from "@/lib/format";

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

/** "15 Oct 2026 · G03" (+ label) */
export function groupTitle(g: { travel_date: string; group_code: string; label?: string | null } | null | undefined) {
  if (!g) return "";
  const parts = [formatDate(g.travel_date), g.group_code];
  if (g.label) parts.push(g.label);
  return parts.join(" · ");
}
