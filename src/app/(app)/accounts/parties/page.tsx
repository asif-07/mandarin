import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Building2 } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusPill } from "@/components/shared/status-pill";
import { Totals } from "@/components/accounts/money";
import { NewPartyButton, PartyRowActions, type PartyRecord } from "@/components/accounts/party-dialog";
import { ClearFilters, SearchParamInput, SelectParam } from "@/components/shared/url-filters";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { getDeals, sumByCurrency } from "@/lib/queries/accounts";
import { PARTY_TYPES, labelFor } from "@/lib/constants";

export const metadata: Metadata = { title: "Partners & suppliers" };

export default async function PartiesPage({ searchParams }: { searchParams: Promise<{ q?: string; type?: string; inactive?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const supabase = await createClient();

  let query = supabase.from("parties").select("*").order("name");
  if (sp.type) query = query.eq("party_type", sp.type);
  if (sp.inactive !== "1") query = query.eq("is_active", true);
  if (sp.q) query = query.ilike("name", `%${sp.q.replace(/[%,]/g, "")}%`);

  const [{ data: parties }, deals, { data: unpaid }] = await Promise.all([
    query,
    getDeals(supabase, { status: "active" }),
    supabase.from("expenses").select("party_id, amount, currency").eq("status", "unpaid").not("party_id", "is", null),
  ]);
  const rows = parties ?? [];
  const hasFilters = !!(sp.q || sp.type || sp.inactive);

  return (
    <>
      <PageHeader title="Partners & suppliers" description="B2B partners you sell through and suppliers you pay. Deals, receipts and expenses link back to them." actions={<NewPartyButton />} />

      <Suspense>
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
          <SearchParamInput placeholder="Search name" className="md:w-72" />
          <SelectParam name="type" options={PARTY_TYPES} placeholder="Type" allLabel="All types" />
          <SelectParam name="inactive" options={[{ value: "1", label: "Include inactive" }]} placeholder="Active" allLabel="Active only" />
          <ClearFilters keys={["q", "type", "inactive"]} />
        </div>
      </Suspense>

      {rows.length === 0 ? (
        <EmptyState icon={Building2} title={hasFilters ? "No parties match these filters." : "No partners or suppliers yet."} action={!hasFilters && <NewPartyButton />} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-mr-line">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="micro-label h-10 bg-mr-surface">Name</TableHead>
                <TableHead className="micro-label h-10 bg-mr-surface">Type</TableHead>
                <TableHead className="micro-label hidden h-10 bg-mr-surface md:table-cell">Contact</TableHead>
                <TableHead className="micro-label h-10 bg-mr-surface text-right">Active deals</TableHead>
                <TableHead className="micro-label h-10 bg-mr-surface text-right">They owe us</TableHead>
                <TableHead className="micro-label h-10 bg-mr-surface text-right">We owe them</TableHead>
                <TableHead className="micro-label h-10 bg-mr-surface"><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => {
                const theirDeals = deals.filter((d) => d.party?.id === p.id);
                const owed = sumByCurrency(theirDeals, (d) => d.outstanding);
                const payable = sumByCurrency((unpaid ?? []).filter((e) => e.party_id === p.id), (e) => e.amount);
                const record: PartyRecord & { id: string } = {
                  id: p.id,
                  name: p.name,
                  party_type: p.party_type,
                  contact_name: p.contact_name ?? "",
                  phone: p.phone ?? "",
                  email: p.email ?? "",
                  address: p.address ?? "",
                  country: p.country ?? "",
                  default_currency: p.default_currency,
                  payment_terms: p.payment_terms ?? "",
                  notes: p.notes ?? "",
                  is_active: p.is_active,
                };
                return (
                  <TableRow key={p.id} className={p.is_active ? "" : "opacity-60"}>
                    <TableCell className="py-3">
                      <Link href={`/accounts/parties/${p.id}`} className="font-medium text-mr-ink hover:underline">
                        {p.name}
                      </Link>
                      <span className="block text-xs text-mr-muted">
                        {p.country ?? ""}
                        {p.country && p.default_currency ? " · " : ""}
                        {p.default_currency}
                        {!p.is_active ? " · inactive" : ""}
                      </span>
                    </TableCell>
                    <TableCell className="py-3">
                      <StatusPill label={labelFor(PARTY_TYPES, p.party_type)} tone={p.party_type === "supplier" ? "neutral" : "ink"} />
                    </TableCell>
                    <TableCell className="hidden py-3 text-mr-body md:table-cell">
                      {p.contact_name}
                      {p.phone && <span className="block text-xs text-mr-muted">{p.phone}</span>}
                    </TableCell>
                    <TableCell className="tnum py-3 text-right">{theirDeals.length || "—"}</TableCell>
                    <TableCell className="py-3 text-right">
                      <Totals totals={owed} className="items-end" />
                    </TableCell>
                    <TableCell className="py-3 text-right">
                      <Totals totals={payable} className="items-end" tone={Object.keys(payable).length ? "negative" : undefined} />
                    </TableCell>
                    <TableCell className="py-3 text-right">
                      <PartyRowActions party={record} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
