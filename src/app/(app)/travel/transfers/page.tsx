import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Ticket } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";
import { StatCard, StatGrid } from "@/components/shared/stat-card";
import { Chip } from "@/components/shared/chip";
import { TravelRangeNav, type RangeView } from "@/components/travel/date-param";
import { TicketLink } from "@/components/travel/voucher-row-actions";
import { createClient } from "@/lib/supabase/server";
import { TRANSFER_MODES, VOUCHER_STATUSES, labelFor } from "@/lib/constants";
import { formatDate, formatDateTime, todayISO, toISODate } from "@/lib/format";
import { addDays, addMonths, addWeeks, endOfMonth, endOfWeek, format as formatDf, parseISO, startOfMonth, startOfWeek } from "date-fns";
import { groupRef } from "@/lib/queries/travel";

export const metadata: Metadata = { title: "Transfers & settlement" };

/**
 * Daily transfer / settlement view: every voucher by transfer date with its
 * destination, pax, ticket, status, partner and redemption time, so passengers
 * transported, tickets issued and the amount payable to the ground partner can
 * be cross-checked.
 */
export default async function TransfersPage({ searchParams }: { searchParams: Promise<{ date?: string; view?: string; status?: string }> }) {
  const sp = await searchParams;
  const view: RangeView = sp.view === "all" || sp.view === "week" || sp.view === "month" || sp.view === "quarter" ? sp.view : "day";
  const today = todayISO();
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const anchor = parseISO(date);
  const range =
    view === "week"
      ? { start: startOfWeek(anchor, { weekStartsOn: 1 }), end: endOfWeek(anchor, { weekStartsOn: 1 }) }
      : view === "month"
        ? { start: startOfMonth(anchor), end: endOfMonth(anchor) }
        : view === "quarter"
          ? { start: startOfMonth(anchor), end: endOfMonth(addMonths(anchor, 2)) }
          : { start: anchor, end: anchor };
  const rangeStart = toISODate(range.start);
  const rangeEnd = toISODate(range.end);
  const step = (n: number) => toISODate(view === "day" ? addDays(anchor, n) : view === "week" ? addWeeks(range.start, n) : view === "month" ? addMonths(range.start, n) : addMonths(range.start, 3 * n));
  const rangeLabel = view === "all" ? "All vouchers" : view === "week" ? `Week of ${formatDate(rangeStart)} to ${formatDate(rangeEnd)}` : view === "month" ? formatDf(range.start, "MMMM yyyy") : view === "quarter" ? `${formatDf(range.start, "MMM yyyy")} to ${formatDf(range.end, "MMM yyyy")}` : formatDate(date);

  const supabase = await createClient();
  let q = supabase
    .from("transfer_vouchers")
    .select("id, voucher_no, status, from_place, to_place, transfer_date, pax, transfer_mode, issued_at, ticket_file_name, ticket_uploaded_at, redeemed_at, group:travel_groups!transfer_vouchers_group_id_fkey(id, group_ref, reference_prefix, partner_code, travel_date, travel_end_date, group_code, label), redeemed_partner:scanner_partners!transfer_vouchers_redeemed_partner_id_fkey(code, name), ticket_partner:scanner_partners!transfer_vouchers_ticket_partner_id_fkey(code, name)")
    .order("transfer_date")
    .order("voucher_no")
    .limit(1000);
  if (view !== "all") q = q.gte("transfer_date", rangeStart).lte("transfer_date", rangeEnd);
  if (sp.status && VOUCHER_STATUSES.some((s) => s.value === sp.status)) q = q.eq("status", sp.status);
  const { data, error } = await q;
  const rows = data ?? [];
  const live = rows.filter((r) => r.status !== "cancelled");
  const stats = {
    vouchers: live.length,
    pax: live.reduce((n, r) => n + r.pax, 0),
    redeemed: live.filter((r) => r.status === "redeemed").length,
    redeemedPax: live.filter((r) => r.status === "redeemed").reduce((n, r) => n + r.pax, 0),
    pending: live.filter((r) => r.status === "active").length,
    tickets: live.filter((r) => r.ticket_uploaded_at).length,
  };
  const byDest = new Map<string, { vouchers: number; pax: number; redeemedPax: number }>();
  live.forEach((r) => {
    const d = byDest.get(r.to_place) ?? { vouchers: 0, pax: 0, redeemedPax: 0 };
    d.vouchers += 1;
    d.pax += r.pax;
    if (r.status === "redeemed") d.redeemedPax += r.pax;
    byDest.set(r.to_place, d);
  });

  return (
    <>
      <PageHeader title="Transfers & settlement" description={`${rangeLabel} · ${stats.vouchers} voucher${stats.vouchers === 1 ? "" : "s"} · ${stats.pax} pax`} />
      <Suspense>
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <TravelRangeNav view={view} date={date} today={today} prev={step(-1)} next={step(1)} nearby={[]} rangeLabel={rangeLabel} basePath="/travel/transfers" />
          <span className="flex items-center gap-1 text-xs">
            {[{ value: "", label: "All statuses" }, ...VOUCHER_STATUSES].map((s) => (
              <Link key={s.value} href={{ pathname: "/travel/transfers", query: { ...(view !== "day" ? { view } : {}), date, ...(s.value ? { status: s.value } : {}) } }} className={`rounded-md px-2 py-1 ${(sp.status ?? "") === s.value ? "bg-mr-ink text-white" : "bg-mr-surface text-mr-body hover:text-mr-ink"}`}>
                {s.label}
              </Link>
            ))}
          </span>
        </div>
      </Suspense>

      {!error && rows.length > 0 && (
        <StatGrid cols={6} className="mb-6">
          <StatCard label="Vouchers" value={stats.vouchers} hint={`${stats.pax} pax booked`} tone="ink" />
          <StatCard label="Redeemed" value={stats.redeemed} hint={`${stats.redeemedPax} pax transported`} tone={stats.redeemed ? "success" : "neutral"} />
          <StatCard label="Pending" value={stats.pending} hint="active, not yet redeemed" tone={stats.pending ? "warning" : "success"} />
          <StatCard label="Tickets uploaded" value={stats.tickets} hint={`of ${stats.vouchers} vouchers`} tone={stats.tickets === stats.vouchers ? "success" : "neutral"} />
          <StatCard label="Payable basis" value={`${stats.redeemedPax} pax`} hint="redeemed with ticket evidence" tone="neutral" />
          <StatCard label="Destinations" value={byDest.size} hint={[...byDest.entries()].slice(0, 3).map(([d, v]) => `${d} ${v.redeemedPax}/${v.pax}`).join(" · ") || "—"} tone="neutral" />
        </StatGrid>
      )}

      {error ? (
        <p className="text-sm text-mr-red">Could not load vouchers: {error.message}</p>
      ) : rows.length === 0 ? (
        <EmptyState icon={Ticket} title={view === "day" ? `No transfers on ${formatDate(date)}.` : `No transfer vouchers in ${rangeLabel}.`} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-mr-line bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-mr-surface text-left">
                {["Voucher", "Group", "Date", "Destination", "Pax", "Type", "Ticket", "Status", "Partner", "Redeemed"].map((h) => (
                  <th key={h} className="micro-label h-10 whitespace-nowrap px-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-mr-line">
              {rows.map((r) => (
                <tr key={r.id} className={r.status === "cancelled" ? "text-mr-muted" : ""}>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">
                    {r.status === "cancelled" ? (
                      r.voucher_no
                    ) : (
                      <a href={`/api/vouchers/${r.id}/pdf`} className="hover:underline" title="Customer PDF">
                        {r.voucher_no}
                      </a>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {r.group ? (
                      <Link href={`/travel?date=${r.group.travel_date}`} className="hover:underline">
                        {r.group.group_ref ?? groupRef(r.group)}
                      </Link>
                    ) : (
                      "—"
                    )}
                    {r.group?.partner_code && <Chip tone="ink" className="ml-1">{r.group.partner_code}</Chip>}
                  </td>
                  <td className="tnum whitespace-nowrap px-3 py-2">{formatDate(r.transfer_date)}</td>
                  <td className="px-3 py-2">
                    <span className="block">{r.to_place}</span>
                    <span className="block text-xs text-mr-muted">from {r.from_place}</span>
                  </td>
                  <td className="tnum px-3 py-2 text-right">{r.pax}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs">{r.transfer_mode ? labelFor(TRANSFER_MODES, r.transfer_mode) : "—"}</td>
                  <td className="px-3 py-2">{r.ticket_uploaded_at ? <TicketLink voucherId={r.id} fileName={r.ticket_file_name} /> : <span className="text-xs text-mr-muted">—</span>}</td>
                  <td className="px-3 py-2">
                    <Chip tone={r.status === "redeemed" ? "success" : r.status === "cancelled" ? "muted" : "warning"}>{labelFor(VOUCHER_STATUSES, r.status)}</Chip>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs">{r.redeemed_partner ? `${r.redeemed_partner.code} · ${r.redeemed_partner.name}` : r.ticket_partner ? `${r.ticket_partner.code} (ticket)` : "—"}</td>
                  <td className="tnum whitespace-nowrap px-3 py-2 text-xs">{r.redeemed_at ? formatDateTime(r.redeemed_at) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
