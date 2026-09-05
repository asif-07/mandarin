import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Download, Receipt } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { StatusPill, EXPENSE_TONES } from "@/components/shared/status-pill";
import { Amount, Totals } from "@/components/accounts/money";
import { ExpenseActions, NewExpenseButton, type ExpenseRecord } from "@/components/accounts/expense-dialog";
import { Pagination } from "@/components/shared/pagination";
import { ClearFilters, DateRangeParams, SearchParamInput, SelectParam } from "@/components/shared/url-filters";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { pageRange, parsePage } from "@/lib/pagination";
import { sumByCurrency } from "@/lib/queries/accounts";
import { EXPENSE_STATUSES, labelFor } from "@/lib/constants";
import { daysFromToday, formatDate } from "@/lib/format";
import type { GroupOption } from "@/lib/actions/travel-groups";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Money out" };

type Search = { q?: string; status?: string; category?: string; from?: string; to?: string; page?: string };

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireAdmin();
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const [from, to] = pageRange(page);
  const supabase = await createClient();

  const applyFilters = <T extends { eq: (c: string, v: string) => T; gte: (c: string, v: string) => T; lte: (c: string, v: string) => T; or: (f: string) => T }>(q: T) => {
    if (sp.status) q = q.eq("status", sp.status);
    if (sp.category) q = q.eq("category_id", sp.category);
    if (sp.from) q = q.gte("spent_on", sp.from);
    if (sp.to) q = q.lte("spent_on", sp.to);
    if (sp.q) {
      const like = `%${sp.q.replace(/[%,]/g, "")}%`;
      q = q.or(`expense_ref.ilike.${like},description.ilike.${like},reference.ilike.${like}`);
    }
    return q;
  };

  const [{ data, count, error }, { data: totalsRows }, { data: categories }] = await Promise.all([
    applyFilters(
      supabase
        .from("expenses")
        .select(
          "*, category:expense_categories(name), party:parties(name), deal:deals(id, deal_ref, title, currency, party_id, status, party:parties(name)), group:travel_groups(id, travel_date, travel_end_date, group_code, label, guide_name, reference_prefix, travellers(count)), ledger:bank_accounts(name), creator:profiles!expenses_created_by_fkey(display_name)",
          { count: "exact" },
        )
        .order("spent_on", { ascending: false })
        .order("created_at", { ascending: false })
        .range(from, to),
    ),
    applyFilters(supabase.from("expenses").select("amount, currency, status")).limit(5000),
    supabase.from("expense_categories").select("id, name").order("sort_order").order("name"),
  ]);

  const rows = data ?? [];
  const totals = sumByCurrency(totalsRows ?? [], (r) => r.amount);
  const unpaidTotals = sumByCurrency((totalsRows ?? []).filter((r) => r.status === "unpaid"), (r) => r.amount);
  const hasFilters = !!(sp.q || sp.status || sp.category || sp.from || sp.to);
  const exportQs = new URLSearchParams({ type: "expenses", ...(sp.from ? { from: sp.from } : {}), ...(sp.to ? { to: sp.to } : {}) }).toString();
  const categoryOptions = (categories ?? []).map((c) => ({ value: c.id, label: c.name }));

  return (
    <>
      <PageHeader
        title="Money out"
        description="Costs and overheads. Unpaid expenses are what you still owe suppliers."
        actions={
          <>
            <a href={`/api/accounts/export?${exportQs}`} className={buttonVariants({ variant: "outline" })}>
              <Download /> CSV
            </a>
            <NewExpenseButton />
          </>
        }
      />

      <Suspense>
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
          <SearchParamInput placeholder="Search description or reference" className="md:w-72" />
          <SelectParam name="status" options={EXPENSE_STATUSES} placeholder="Status" allLabel="Paid and unpaid" />
          <SelectParam name="category" options={categoryOptions} placeholder="Category" allLabel="All categories" />
          <DateRangeParams />
          <ClearFilters keys={["q", "status", "category", "from", "to"]} />
          <span className="text-sm text-mr-body md:ml-auto">
            Total: <Totals totals={totals} className="inline-flex flex-row gap-3" />
            {Object.keys(unpaidTotals).length > 0 && (
              <span className="ml-3 text-mr-warning">
                unpaid: <Totals totals={unpaidTotals} className="inline-flex flex-row gap-3" />
              </span>
            )}
          </span>
        </div>
      </Suspense>

      {error ? (
        <p className="text-sm text-mr-red">Could not load expenses: {error.message}</p>
      ) : rows.length === 0 ? (
        <EmptyState icon={Receipt} title={hasFilters ? "No expenses match these filters." : "No expenses recorded yet."} action={!hasFilters && <NewExpenseButton />} />
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-lg border border-mr-line md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="micro-label h-10 bg-mr-surface">Expense</TableHead>
                  <TableHead className="micro-label h-10 bg-mr-surface">Date</TableHead>
                  <TableHead className="micro-label h-10 bg-mr-surface">Category</TableHead>
                  <TableHead className="micro-label h-10 bg-mr-surface">Supplier · deal</TableHead>
                  <TableHead className="micro-label h-10 bg-mr-surface text-right">Amount</TableHead>
                  <TableHead className="micro-label h-10 bg-mr-surface">Status</TableHead>
                  <TableHead className="micro-label h-10 bg-mr-surface"><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((e) => {
                  const overdue = e.status === "unpaid" && e.due_on && (daysFromToday(e.due_on) ?? 0) < 0;
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="py-3">
                        <span className="font-medium text-mr-ink">{e.expense_ref}</span>
                        <span className="block max-w-[280px] truncate text-mr-body">{e.description}</span>
                      </TableCell>
                      <TableCell className="tnum whitespace-nowrap py-3">
                        {formatDate(e.spent_on)}
                        {e.status === "unpaid" && e.due_on && <span className={cn("block text-xs", overdue ? "text-mr-red" : "text-mr-muted")}>due {formatDate(e.due_on)}</span>}
                        {e.status === "paid" && e.paid_on && e.paid_on !== e.spent_on && <span className="block text-xs text-mr-muted">paid {formatDate(e.paid_on)}</span>}
                      </TableCell>
                      <TableCell className="py-3 text-mr-body">{e.category?.name}</TableCell>
                      <TableCell className="py-3">
                        {e.party?.name && <span className="block">{e.party.name}</span>}
                        {e.deal && (
                          <Link href={`/accounts/deals/${e.deal.id}`} className="block text-xs text-mr-muted hover:underline">
                            {e.deal.deal_ref} · {e.deal.title}
                          </Link>
                        )}
                        {!e.party?.name && !e.deal && <span className="text-mr-muted">—</span>}
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        <Amount value={e.amount} currency={e.currency} signed="out" className="font-medium" />
                        {e.ledger?.name && <span className="block text-xs text-mr-muted">{e.ledger.name}</span>}
                      </TableCell>
                      <TableCell className="py-3">
                        <StatusPill label={labelFor(EXPENSE_STATUSES, e.status)} tone={overdue ? "red" : EXPENSE_TONES[e.status]} />
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        <ExpenseActions expense={toRecord(e)} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <ul className="space-y-3 md:hidden">
            {rows.map((e) => (
              <li key={e.id} className="rounded-lg border border-mr-line p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-mr-ink">{e.description}</p>
                    <p className="truncate text-xs text-mr-muted">
                      {e.expense_ref} · {e.category?.name}
                      {e.party?.name ? ` · ${e.party.name}` : ""}
                    </p>
                  </div>
                  <ExpenseActions expense={toRecord(e)} />
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="tnum text-mr-muted">{formatDate(e.spent_on)}</span>
                  <Amount value={e.amount} currency={e.currency} signed="out" className="font-medium" />
                </div>
                <div className="mt-2">
                  <StatusPill label={labelFor(EXPENSE_STATUSES, e.status)} tone={EXPENSE_TONES[e.status]} />
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
  expense_ref: string;
  spent_on: string;
  amount: number;
  currency: string;
  category_id: string;
  description: string;
  party_id: string | null;
  travel_group_id: string | null;
  status: string;
  due_on: string | null;
  paid_on: string | null;
  method: string | null;
  bank_account_id: string | null;
  reference: string | null;
  notes: string | null;
  deal: { id: string; deal_ref: string; title: string; currency: string; party_id: string; status: string; party: { name: string } | null } | null;
  group: { id: string; travel_date: string; travel_end_date: string; group_code: string; label: string | null; guide_name: string | null; reference_prefix: string; travellers: { count: number }[] } | null;
};

function toRecord(e: Row): ExpenseRecord & { id: string; expense_ref: string } {
  const group: GroupOption | null = e.group
    ? {
        id: e.group.id,
        travel_date: e.group.travel_date,
        travel_end_date: e.group.travel_end_date,
        group_code: e.group.group_code,
        label: e.group.label,
        guide_name: e.group.guide_name,
        reference_prefix: e.group.reference_prefix,
        traveller_count: Array.isArray(e.group.travellers) ? Number(e.group.travellers[0]?.count ?? 0) : 0,
      }
    : null;
  return {
    id: e.id,
    expense_ref: e.expense_ref,
    spent_on: e.spent_on,
    amount: String(e.amount),
    currency: e.currency,
    category_id: e.category_id,
    description: e.description,
    party_id: e.party_id,
    deal: e.deal ? { id: e.deal.id, deal_ref: e.deal.deal_ref, title: e.deal.title, currency: e.deal.currency, party_id: e.deal.party_id, party_name: e.deal.party?.name ?? "", status: e.deal.status } : null,
    travel_group_id: e.travel_group_id,
    group,
    status: e.status,
    due_on: e.due_on,
    paid_on: e.paid_on,
    method: e.method ?? "bank_transfer",
    bank_account_id: e.bank_account_id,
    reference: e.reference ?? "",
    notes: e.notes ?? "",
  };
}
