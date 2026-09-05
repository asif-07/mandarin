import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Handshake } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusPill, DEAL_TONES } from "@/components/shared/status-pill";
import { Amount, MoneyStat } from "@/components/accounts/money";
import { NewDealButton } from "@/components/accounts/deal-dialog";
import { ClearFilters, SearchParamInput, SelectParam } from "@/components/shared/url-filters";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { getDeals, sumByCurrency } from "@/lib/queries/accounts";
import { DEAL_STATUSES, labelFor } from "@/lib/constants";
import { formatDate, formatDateRange } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "B2B deals" };

export default async function DealsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; party?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const supabase = await createClient();
  const deals = await getDeals(supabase, { q: sp.q, status: sp.status, partyId: sp.party });
  const active = deals.filter((d) => d.status === "active");
  const hasFilters = !!(sp.q || sp.status || sp.party);

  return (
    <>
      <PageHeader title="B2B deals" description="Agreements with partner agencies and corporate clients, with what has been invoiced, received and spent on each." actions={<NewDealButton />} />

      <div className="grid gap-4 sm:grid-cols-3">
        <MoneyStat label="Active deal value" totals={sumByCurrency(active, (d) => d.deal_value)} hint={`${active.length} active deal${active.length === 1 ? "" : "s"}`} />
        <MoneyStat label="Received on active deals" totals={sumByCurrency(active, (d) => d.received)} tone="positive" />
        <MoneyStat label="Still to receive" totals={sumByCurrency(active, (d) => d.outstanding)} hint="deal value or invoiced, minus received" />
      </div>

      <Suspense>
        <div className="mt-6 mb-4 flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
          <SearchParamInput placeholder="Search reference or title" className="md:w-72" />
          <SelectParam name="status" options={DEAL_STATUSES} placeholder="Status" allLabel="All statuses" />
          <ClearFilters keys={["q", "status", "party"]} />
        </div>
      </Suspense>

      {deals.length === 0 ? (
        <EmptyState icon={Handshake} title={hasFilters ? "No deals match these filters." : "No B2B deals yet. Add a partner first, then create a deal."} action={!hasFilters && <NewDealButton />} />
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-lg border border-mr-line md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="micro-label h-10 bg-mr-surface">Deal</TableHead>
                  <TableHead className="micro-label h-10 bg-mr-surface">Partner</TableHead>
                  <TableHead className="micro-label h-10 bg-mr-surface">Travel</TableHead>
                  <TableHead className="micro-label h-10 bg-mr-surface text-right">Value</TableHead>
                  <TableHead className="micro-label h-10 bg-mr-surface text-right">Invoiced</TableHead>
                  <TableHead className="micro-label h-10 bg-mr-surface text-right">Received</TableHead>
                  <TableHead className="micro-label h-10 bg-mr-surface text-right">Outstanding</TableHead>
                  <TableHead className="micro-label h-10 bg-mr-surface text-right">Costs</TableHead>
                  <TableHead className="micro-label h-10 bg-mr-surface">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deals.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="py-3">
                      <Link href={`/accounts/deals/${d.id}`} className="font-medium text-mr-ink hover:underline">
                        {d.deal_ref}
                      </Link>
                      <span className="block max-w-[260px] truncate text-xs text-mr-body">{d.title}</span>
                    </TableCell>
                    <TableCell className="py-3">
                      {d.party ? (
                        <Link href={`/accounts/parties/${d.party.id}`} className="hover:underline">
                          {d.party.name}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="tnum whitespace-nowrap py-3 text-mr-body">
                      {d.start_date ? formatDateRange(d.start_date, d.end_date ?? d.start_date) : "—"}
                      {d.pax_count ? <span className="ml-1 text-xs text-mr-muted">· {d.pax_count} pax</span> : null}
                    </TableCell>
                    <TableCell className="py-3 text-right">
                      <Amount value={d.deal_value} currency={d.currency} />
                    </TableCell>
                    <TableCell className="py-3 text-right">
                      <Amount value={d.invoiced} currency={d.currency} className="text-mr-body" />
                    </TableCell>
                    <TableCell className="py-3 text-right">
                      <Amount value={d.received} currency={d.currency} className="text-mr-success" />
                    </TableCell>
                    <TableCell className="py-3 text-right">
                      <Amount value={d.outstanding} currency={d.currency} className={cn("font-medium", d.outstanding > 0 && d.status === "active" && "text-mr-red")} />
                    </TableCell>
                    <TableCell className="py-3 text-right">
                      <Amount value={d.costs} currency={d.currency} className="text-mr-body" />
                      {d.costs_other_currency > 0 && <span className="block text-[11px] text-mr-muted">+{d.costs_other_currency} in other currencies</span>}
                    </TableCell>
                    <TableCell className="py-3">
                      <StatusPill label={labelFor(DEAL_STATUSES, d.status)} tone={DEAL_TONES[d.status]} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ul className="space-y-3 md:hidden">
            {deals.map((d) => (
              <li key={d.id} className="rounded-lg border border-mr-line p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/accounts/deals/${d.id}`} className="block font-medium text-mr-ink">
                      {d.deal_ref}
                    </Link>
                    <p className="truncate text-sm text-mr-body">{d.title}</p>
                    <p className="truncate text-xs text-mr-muted">
                      {d.party?.name}
                      {d.payment_due_on ? ` · due ${formatDate(d.payment_due_on)}` : ""}
                    </p>
                  </div>
                  <StatusPill label={labelFor(DEAL_STATUSES, d.status)} tone={DEAL_TONES[d.status]} />
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <dt className="text-mr-muted">Value</dt>
                    <dd>
                      <Amount value={d.deal_value} currency={d.currency} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-mr-muted">Received</dt>
                    <dd>
                      <Amount value={d.received} currency={d.currency} className="text-mr-success" />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-mr-muted">Outstanding</dt>
                    <dd>
                      <Amount value={d.outstanding} currency={d.currency} className={cn("font-medium", d.outstanding > 0 && "text-mr-red")} />
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
