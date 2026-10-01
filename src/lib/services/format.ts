import { TRANSFER_MODES, labelFor } from "@/lib/constants";
import { formatDate } from "@/lib/format";

/** The fields a group service needs for its one-line summary and the voucher. */
export type ServiceDetails = {
  service_name: string;
  kind: string;
  from_place?: string | null;
  to_place?: string | null;
  service_date?: string | null;
  pax?: number | null;
  transfer_mode?: string | null;
  notes?: string | null;
};

/** "Hong Kong International Airport → Guangzhou · 12 Oct 2026 · 8 pax · Seat in Coach" (or the notes for a general service). */
export function serviceSummary(s: ServiceDetails): string {
  if (s.kind === "airport_transfer") {
    const parts = [
      s.from_place || s.to_place ? `${s.from_place ?? "?"} → ${s.to_place ?? "?"}` : null,
      s.service_date ? formatDate(s.service_date) : null,
      s.pax ? `${s.pax} pax` : null,
      s.transfer_mode ? labelFor(TRANSFER_MODES, s.transfer_mode) : null,
      s.notes,
    ];
    return parts.filter(Boolean).join(" · ");
  }
  return [s.service_date ? formatDate(s.service_date) : null, s.pax ? `${s.pax} pax` : null, s.notes].filter(Boolean).join(" · ");
}

/** Invoice line for a group service: the exact master name as the title, the details as the description. */
export function serviceInvoiceLine(s: ServiceDetails & { quantity?: number | null; rate?: number | null }): { title: string; description: string; quantity: number; rate: number } {
  return {
    title: s.service_name,
    description: serviceSummary(s),
    quantity: s.kind === "airport_transfer" && s.pax ? s.pax : Number(s.quantity ?? 1) || 1,
    rate: Number(s.rate ?? 0) || 0,
  };
}
