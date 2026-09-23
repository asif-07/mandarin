import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FileText, Plus } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { InvoiceTable, type InvoiceListRow } from "@/components/invoices/invoice-table";
import { Pagination } from "@/components/shared/pagination";
import { pageRange, parsePage } from "@/lib/pagination";
import { ClearFilters, DateRangeParams, SearchParamInput, SelectParam } from "@/components/shared/url-filters";
import { createClient } from "@/lib/supabase/server";
import { INVOICE_STATUSES, labelFor } from "@/lib/constants";
import { formatMoney } from "@/lib/format";

export const metadata: Metadata = { title: "Invoices" };

type Search = { q?: string; status?: string; from?: string; to?: string; page?: string };

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const [from, to] = pageRange(page);
  const supabase = await createClient();

  let query = supabase
    .from("invoices")
    .select("id, invoice_number, bill_to_name, issue_date, total, currency, status, creator:profiles!invoices_created_by_fkey(display_name)", {
      count: "exact",
    })
    .order("sequence_number", { ascending: false })
    .range(from, to);

  if (sp.status) query = query.eq("status", sp.status);
  if (sp.from) query = query.gte("issue_date", sp.from);
  if (sp.to) query = query.lte("issue_date", sp.to);
  if (sp.q) {
    const like = `%${sp.q.replace(/[%,]/g, "")}%`;
    query = query.or(`invoice_number.ilike.${like},bill_to_name.ilike.${like}`);
  }

  // Totals for the same filters, across every page (billed = issued + paid; drafts and cancelled shown separately).
  let totalsQuery = supabase.from("invoices").select("total, currency, status").limit(5000);
  if (sp.status) totalsQuery = totalsQuery.eq("status", sp.status);
  if (sp.from) totalsQuery = totalsQuery.gte("issue_date", sp.from);
  if (sp.to) totalsQuery = totalsQuery.lte("issue_date", sp.to);
  if (sp.q) {
    const like = `%${sp.q.replace(/[%,()]/g, "")}%`;
    totalsQuery = totalsQuery.or(`invoice_number.ilike.${like},bill_to_name.ilike.${like}`);
  }
  const [{ data, count, error }, { data: totalRows }] = await Promise.all([query, totalsQuery]);
  const billed = new Map<string, number>();
  const other = new Map<string, number>();
  (totalRows ?? []).forEach((r) => {
    const target = r.status === "issued" || r.status === "paid" ? billed : other;
    target.set(r.currency, (target.get(r.currency) ?? 0) + Number(r.total));
  });
  const money = (m: Map<string, number>) => [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([c, v]) => formatMoney(v, c)).join(" · ");
  const shownFrom = count ? from + 1 : 0;
  const shownTo = count ? Math.min(to + 1, count) : 0;
  const rows: InvoiceListRow[] = (data ?? []).map((r) => ({
    id: r.id,
    invoice_number: r.invoice_number,
    bill_to_name: r.bill_to_name,
    issue_date: r.issue_date,
    total: Number(r.total),
    currency: r.currency,
    status: r.status,
    created_by_name: r.creator?.display_name ?? null,
  }));
  const hasFilters = !!(sp.q || sp.status || sp.from || sp.to);

  return (
    <>
      <PageHeader
        title="Invoices"
        description={
          count
            ? `Showing ${shownFrom}–${shownTo} of ${count} invoice${count === 1 ? "" : "s"}${hasFilters ? " (filtered)" : ""} · Billed ${billed.size ? money(billed) : "0"}${other.size ? ` · ${sp.status ? labelFor(INVOICE_STATUSES, sp.status) : "draft or cancelled"} ${money(other)}` : ""}`
            : "No invoices to show"
        }
        actions={
          <Link href="/invoices/new" className={buttonVariants()}>
            <Plus /> New invoice
          </Link>
        }
      />

      <Suspense>
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
          <SearchParamInput placeholder="Search number or name" className="md:w-72" />
          <SelectParam name="status" options={INVOICE_STATUSES} placeholder="Status" allLabel="All statuses" />
          <DateRangeParams />
          <ClearFilters keys={["q", "status", "from", "to"]} />
        </div>
      </Suspense>

      {error ? (
        <p className="text-sm text-mr-red">Could not load invoices: {error.message}</p>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={hasFilters ? "No invoices match these filters." : "No invoices yet. Create the first one."}
          action={
            !hasFilters && (
              <Link href="/invoices/new" className={buttonVariants()}>
                <Plus /> New invoice
              </Link>
            )
          }
        />
      ) : (
        <>
          <InvoiceTable rows={rows} />
          <Suspense>
            <Pagination page={page} total={count ?? 0} />
          </Suspense>
        </>
      )}
    </>
  );
}
