import Link from "next/link";
import { notFound } from "next/navigation";
import { PortalShell } from "@/components/portal/shell";
import { Chip } from "@/components/shared/chip";
import { loadArrivalByToken } from "@/lib/arrivals/server";
import { ARRIVAL_STATUSES } from "@/lib/arrivals/shared";
import { GROUND_BRAND, labelFor } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Tracking page for one submission: what was sent and CTS's reply. Reachable only with the token from the confirmation. */
export default async function ArrivalTrackPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const a = await loadArrivalByToken(token);
  if (!a) notFound();
  const rows: [string, string][] = [
    ["Reference", a.ref],
    ["Partner code", a.partner_code],
    ["Arrival date", formatDate(a.arrival_date)],
    ["Airline & flight", a.airline_flight],
    ["Arrival time", a.arrival_time],
    ["Passengers", String(a.pax)],
    ...(a.agent_name ? ([["Sent by", a.agent_name]] as [string, string][]) : []),
    ...(a.agent_notes ? ([["Your notes", a.agent_notes]] as [string, string][]) : []),
    ["Sent", formatDateTime(a.created_at)],
  ];
  return (
    <PortalShell title="Hong Kong group arrival details" subtitle={`${GROUND_BRAND.name} · airport transfer`} homeHref="/arrivals">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="font-heading text-lg font-semibold">{a.ref}</h1>
        <Chip tone={a.status === "new" ? "warning" : a.status === "closed" ? "muted" : "success"}>{labelFor(ARRIVAL_STATUSES, a.status)}</Chip>
      </div>
      <div className={`mb-4 rounded-lg border p-4 ${a.admin_reply ? "border-mr-success/40 bg-mr-success/5" : "border-mr-line bg-white"}`}>
        <p className="micro-label mb-1">Reply from {GROUND_BRAND.name}</p>
        {a.admin_reply ? (
          <>
            <p className="whitespace-pre-wrap text-sm text-mr-ink">{a.admin_reply}</p>
            <p className="mt-2 text-xs text-mr-muted">
              {a.replied_at ? formatDateTime(a.replied_at) : ""}
              {a.replied_by ? ` · ${a.replied_by}` : ""}
            </p>
          </>
        ) : (
          <p className="text-sm text-mr-muted">No reply yet. Check back here later; this page updates when we respond.</p>
        )}
      </div>
      <dl className="divide-y divide-mr-line rounded-lg border border-mr-line bg-white px-4">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-3 py-2">
            <dt className="text-xs text-mr-muted">{k}</dt>
            <dd className="text-right text-sm font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-5 text-xs text-mr-muted">
        <Link href="/arrivals" className="underline">
          Send another arrival
        </Link>
      </p>
    </PortalShell>
  );
}
