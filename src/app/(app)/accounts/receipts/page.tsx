import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Banknote, Download } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { Amount, Totals } from "@/components/accounts/money";
import { ReceiptActions, RecordReceiptButton, type ReceiptRecord } from "@/components/accounts/receipt-dialog";
import { Pagination } from "@/components/shared/pagination";
import { ClearFilters, DateRangeParams, SearchParamInput, SelectParam } from "@/components/shared/url-filters";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { pageRange, parsePage } from "@/lib/pagination";
import { sumByCurrency } from "@/lib/queries/accounts";
import { PAYMENT_METHODS, labelFor } from "@/lib/constants";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Money in" };

type Search = { q?: string; method?: string; from?: string; to?: string; page?: string };

export default async function ReceiptsPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireAdmin();
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const [from, to] = pageRange(page);
  const supabase = await createClient();

  const applyFilters = <T extends { eq: (c: string, v: string) => T; gte: (c: string, v: string) => T; lte: (c: string, v: string) => T; or: (f: string) => T }>(q: T) => {
    if (sp.method) q = q.eq("method", sp.method);
    if (sp.from) q = q.gte("received_on", sp.from);
    if (sp.to) q = q.lte("received_on", sp.to);
    if (sp.q) {
      const like = `%${sp.q.replace(/[%,]/g, "")}%`;
      q = q.or(`receipt_ref.ilike.${like},payer_name.ilike.${like},reference.ilike.${like}`);
    }
    return q;
  };

  const [{ data, count, error }, { data: totalsRows }] = await Promise.all([
    applyFilters(
      supabase
        .from("receipts")
        .select(
          "*, invoice:invoices(id, invoice_number, bill_to_name, issue_date, total, currency, status, deal_id), deal:deals(id, deal_ref, title, currency, party_id, status, party:parties(name)), party:parties(name), ledger:bank_accounts(name), creator:profiles!receipts_created_by_fkey(display_name)",
          { count: "exact" },
        )
        .order("received_on", { ascending: false })
        .order("created_at", { ascending: false })
        .range(from, to),
    ),
    applyFilters(supabase.from("receipts").select("amount, currency")).limit(5000),
  ]);

  const rows = data ?? [];
  const totals = sumByCurrency(totalsRows ?? [], (r) => r.amount);
  const hasFilters = !!(sp.q || sp.method || sp.from || sp.to);
  const exportQs = new URLSearchParams({ type: "receipts", ...(sp.from ? { from: sp.from } : {}), ...(sp.to ? { to: sp.to } : {}) }).toString();

  return (
    <>
      <PageHeader
        title="Money in"
        description="Every payment received: against invoices, B2B deals, or other income."
        actions={
          <>
            <a href={`/api/accounts/export?${exportQs}`} className={buttonVariants({ variant: "outline" })}>
              <Download /> CSV
            </a>
            <RecordReceiptButton />
          </>
        }
      />

      <Suspense>
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
          <SearchParamInput placeholder="Search reference or payer" className="md:w-72" />
          <SelectParam name="method" options={PAYMENT_METHODS} placeholder="Method" allLabel="All methods" />
          <DateRangeParams />
          <ClearFilters keys={["q", "method", "from", "to"]} />
          <span className="text-sm text-mr-body md:ml-auto">
            Total: <Totals totals={totals} className="inline-flex flex-row gap-3" />
          </span>
        </div>
      </Suspense>

      {error ? (
        <p className="text-sm text-mr-red">Could not load receipts: {error.message}</p>
      ) : rows.length === 0 ? (
        <EmptyState icon={Banknote} title={hasFilters ? "No receipts match these filters." : "No money received recorded yet."} action={!hasFilters && <RecordReceiptButton />} />
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-lg border border-mr-line md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="micro-label h-10 bg-mr-surface">Receipt</TableHead>
                  <TableHead className="micro-label h-10 bg-mr-surface">Date</TableHead>
                  <TableHead className="micro-label h-10 bg-mr-surface">Against</TableHead>
                  <TableHead className="micro-label h-10 bg-mr-surface">Method · ledger</TableHead>
                  <TableHead className="micro-label h-10 bg-mr-surface text-right">Amount</TableHead>
                  <TableHead className="micro-label h-10 bg-mr-surface">By</TableHead>
                  <TableHead className="micro-label h-10 bg-mr-surface"><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="py-3 font-medium text-mr-ink">
                      {r.receipt_ref}
                      {r.reference && <span className="block max-w-[200px] truncate font-mono text-[11px] font-normal text-mr-muted">{r.reference}</span>}
                    </TableCell>
                    <TableCell className="tnum whitespace-nowrap py-3">{formatDate(r.received_on)}</TableCell>
                    <TableCell className="py-3">
                      {r.invoice ? (
                        <Link href={`/invoices/${r.invoice.id}`} className="hover:underline">
                          <span className="font-medium">{r.invoice.invoice_number}</span> <span className="text-mr-body">{r.invoice.bill_to_name}</span>
                        </Link>
                      ) : r.deal ? (
                        <Link href={`/accounts/deals/${r.deal.id}`} className="hover:underline">
                          <span className="font-medium">{r.deal.deal_ref}</span> <span className="text-mr-body">{r.deal.title}</span>
                        </Link>
                      ) : (
                        <span className="text-mr-body">{r.payer_name || r.party?.name || "Other income"}</span>
                      )}
                      {r.invoice && r.deal && <span className="block text-xs text-mr-muted">{r.deal.deal_ref}</span>}
                    </TableCell>
                    <TableCell className="py-3 text-mr-body">
                      {labelFor(PAYMENT_METHODS, r.method)}
                      {r.ledger?.name && <span className="block text-xs text-mr-muted">{r.ledger.name}</span>}
                    </TableCell>
                    <TableCell className="py-3 text-right">
                      <Amount value={r.amount} currency={r.currency} signed="in" className="font-medium" />
                      {r.applied_amount !== null && r.invoice && r.invoice.currency !== r.currency && (
                        <span className="block text-xs text-mr-muted">
                          = {r.invoice.currency} {Number(r.applied_amount).toFixed(2)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="py-3 text-mr-body">{r.creator?.display_name ?? "—"}</TableCell>
                    <TableCell className="py-3 text-right">
                      <ReceiptActions receipt={toRecord(r)} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ul className="space-y-3 md:hidden">
            {rows.map((r) => (
              <li key={r.id} className="rounded-lg border border-mr-line p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-mr-ink">{r.receipt_ref}</p>
                    <p className="truncate text-sm text-mr-body">
                      {r.invoice ? `${r.invoice.invoice_number} · ${r.invoice.bill_to_name}` : r.deal ? `${r.deal.deal_ref} · ${r.deal.title}` : r.payer_name || r.party?.name || "Other income"}
                    </p>
                  </div>
                  <ReceiptActions receipt={toRecord(r)} />
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="tnum text-mr-muted">
                    {formatDate(r.received_on)} · {labelFor(PAYMENT_METHODS, r.method)}
                  </span>
                  <Amount value={r.amount} currency={r.currency} signed="in" className="font-medium" />
                </div>
              </li>
            ))}
          </ul>
          <Suspense>
            <Pagination page={page} total={count ?? 0} />
          </Suspense>
        </>
      )}
    </>
  );
}

type Row = {
  id: string;
  receipt_ref: string;
  received_on: string;
  amount: number;
  currency: string;
  applied_amount: number | null;
  method: string;
  bank_account_id: string | null;
  party_id: string | null;
  payer_name: string | null;
  reference: string | null;
  notes: string | null;
  invoice: { id: string; invoice_number: string; bill_to_name: string; issue_date: string; total: number; currency: string; status: string; deal_id: string | null } | null;
  deal: { id: string; deal_ref: string; title: string; currency: string; party_id: string; status: string; party: { name: string } | null } | null;
};

function toRecord(r: Row): ReceiptRecord & { id: string; receipt_ref: string } {
  return {
    id: r.id,
    receipt_ref: r.receipt_ref,
    received_on: r.received_on,
    amount: String(r.amount),
    currency: r.currency,
    applied_amount: r.applied_amount === null ? "" : String(r.applied_amount),
    method: r.method,
    bank_account_id: r.bank_account_id,
    invoice: r.invoice ? { ...r.invoice, total: Number(r.invoice.total), received: 0, balance: 0 } : null,
    deal: r.deal ? { id: r.deal.id, deal_ref: r.deal.deal_ref, title: r.deal.title, currency: r.deal.currency, party_id: r.deal.party_id, party_name: r.deal.party?.name ?? "", status: r.deal.status } : null,
    party_id: r.party_id,
    payer_name: r.payer_name ?? "",
    reference: r.reference ?? "",
    notes: r.notes ?? "",
  };
}
