import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusPill, DEAL_TONES, EXPENSE_TONES } from "@/components/shared/status-pill";
import { Amount, MoneyStat } from "@/components/accounts/money";
import { PartyRowActions, type PartyRecord } from "@/components/accounts/party-dialog";
import { NewDealButton } from "@/components/accounts/deal-dialog";
import { RecordReceiptButton } from "@/components/accounts/receipt-dialog";
import { NewExpenseButton } from "@/components/accounts/expense-dialog";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { getDeals, sumByCurrency } from "@/lib/queries/accounts";
import { DEAL_STATUSES, EXPENSE_STATUSES, PARTY_TYPES, PAYMENT_METHODS, labelFor } from "@/lib/constants";
import { formatDate, formatDateRange } from "@/lib/format";

export const metadata: Metadata = { title: "Party" };

export default async function PartyPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();
  const { data: party } = await supabase.from("parties").select("*").eq("id", id).maybeSingle();
  if (!party) notFound();

  const [deals, { data: receipts }, { data: expenses }] = await Promise.all([
    getDeals(supabase, { partyId: id }),
    supabase
      .from("receipts")
      .select("id, receipt_ref, received_on, amount, currency, method, reference, invoice:invoices(id, invoice_number), deal:deals(id, deal_ref)")
      .eq("party_id", id)
      .order("received_on", { ascending: false })
      .limit(50),
    supabase
      .from("expenses")
      .select("id, expense_ref, spent_on, amount, currency, description, status, due_on, category:expense_categories(name), deal:deals(id, deal_ref)")
      .eq("party_id", id)
      .order("spent_on", { ascending: false })
      .limit(50),
  ]);

  const isPartner = party.party_type !== "supplier";
  const isSupplier = party.party_type !== "b2b_partner";
  const active = deals.filter((d) => d.status === "active");
  const payables = sumByCurrency((expenses ?? []).filter((e) => e.status === "unpaid"), (e) => e.amount);
  const record: PartyRecord & { id: string } = {
    id: party.id,
    name: party.name,
    party_type: party.party_type,
    contact_name: party.contact_name ?? "",
    phone: party.phone ?? "",
    email: party.email ?? "",
    address: party.address ?? "",
    country: party.country ?? "",
    default_currency: party.default_currency,
    payment_terms: party.payment_terms ?? "",
    notes: party.notes ?? "",
    is_active: party.is_active,
  };

  return (
    <>
      <PageHeader
        title={party.name}
        description={`${labelFor(PARTY_TYPES, party.party_type)}${party.country ? ` · ${party.country}` : ""}${!party.is_active ? " · inactive" : ""}`}
        actions={
          <>
            {isSupplier && <NewExpenseButton variant="outline" partyId={party.id} currency={party.default_currency} />}
            {isPartner && <RecordReceiptButton variant="outline" partyId={party.id} />}
            {isPartner && <NewDealButton partyId={party.id} currency={party.default_currency} />}
            <PartyRowActions party={record} />
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isPartner && <MoneyStat label="Active deal value" totals={sumByCurrency(active, (d) => d.deal_value)} hint={`${active.length} active deal${active.length === 1 ? "" : "s"}`} />}
        {isPartner && <MoneyStat label="They still owe" totals={sumByCurrency(active, (d) => d.outstanding)} tone={active.some((d) => d.outstanding > 0) ? "negative" : undefined} />}
        {isPartner && <MoneyStat label="Received from them" totals={sumByCurrency(receipts ?? [], (r) => r.amount)} tone="positive" hint="all time" />}
        {isSupplier && <MoneyStat label="We owe them" totals={payables} tone={Object.keys(payables).length ? "negative" : undefined} hint="unpaid expenses" />}
        {isSupplier && <MoneyStat label="Paid to them" totals={sumByCurrency((expenses ?? []).filter((e) => e.status === "paid"), (e) => e.amount)} hint="all time" />}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          {isPartner && (
            <Card>
              <CardHeader>
                <CardTitle>Deals</CardTitle>
              </CardHeader>
              <CardContent>
                {deals.length === 0 ? (
                  <p className="text-sm text-mr-muted">No deals with this partner yet.</p>
                ) : (
                  <ul className="divide-y divide-mr-line">
                    {deals.map((d) => (
                      <li key={d.id} className="flex items-center gap-3 py-2.5 text-sm">
                        <div className="min-w-0 flex-1">
                          <Link href={`/accounts/deals/${d.id}`} className="font-medium text-mr-ink hover:underline">
                            {d.deal_ref}
                          </Link>
                          <span className="ml-2 text-mr-body">{d.title}</span>
                          <p className="truncate text-xs text-mr-muted">
                            {d.start_date ? formatDateRange(d.start_date, d.end_date ?? d.start_date) : "no dates"}
                            {d.pax_count ? ` · ${d.pax_count} pax` : ""} · received {d.received.toFixed(2)} of {Math.max(d.deal_value, d.invoiced).toFixed(2)}
                          </p>
                        </div>
                        <Amount value={d.outstanding} currency={d.currency} className={d.outstanding > 0 && d.status === "active" ? "font-medium text-mr-red" : "font-medium"} />
                        <StatusPill label={labelFor(DEAL_STATUSES, d.status)} tone={DEAL_TONES[d.status]} />
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}

          {isPartner && (
            <Card>
              <CardHeader>
                <CardTitle>Money received</CardTitle>
              </CardHeader>
              <CardContent>
                {!receipts || receipts.length === 0 ? (
                  <p className="text-sm text-mr-muted">Nothing received from this partner yet.</p>
                ) : (
                  <ul className="divide-y divide-mr-line">
                    {receipts.map((r) => (
                      <li key={r.id} className="flex items-center gap-3 py-2.5 text-sm">
                        <span className="tnum w-24 shrink-0 text-xs text-mr-muted">{formatDate(r.received_on)}</span>
                        <span className="min-w-0 flex-1 truncate">
                          <span className="font-medium text-mr-ink">{r.receipt_ref}</span>
                          <span className="ml-2 text-mr-body">
                            {labelFor(PAYMENT_METHODS, r.method)}
                            {r.invoice ? ` · ${r.invoice.invoice_number}` : r.deal ? ` · ${r.deal.deal_ref}` : ""}
                          </span>
                        </span>
                        <Amount value={r.amount} currency={r.currency} signed="in" className="font-medium" />
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}

          {isSupplier && (
            <Card>
              <CardHeader>
                <CardTitle>Expenses with this supplier</CardTitle>
              </CardHeader>
              <CardContent>
                {!expenses || expenses.length === 0 ? (
                  <p className="text-sm text-mr-muted">No expenses recorded for this supplier yet.</p>
                ) : (
                  <ul className="divide-y divide-mr-line">
                    {expenses.map((e) => (
                      <li key={e.id} className="flex items-center gap-3 py-2.5 text-sm">
                        <span className="tnum w-24 shrink-0 text-xs text-mr-muted">{formatDate(e.spent_on)}</span>
                        <span className="min-w-0 flex-1 truncate">
                          <span className="text-mr-ink">{e.description}</span>
                          <span className="ml-2 text-xs text-mr-muted">
                            {e.category?.name}
                            {e.deal ? ` · ${e.deal.deal_ref}` : ""}
                            {e.status === "unpaid" && e.due_on ? ` · due ${formatDate(e.due_on)}` : ""}
                          </span>
                        </span>
                        <StatusPill label={labelFor(EXPENSE_STATUSES, e.status)} tone={EXPENSE_TONES[e.status]} />
                        <Amount value={e.amount} currency={e.currency} signed="out" className="font-medium" />
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <dl className="grid grid-cols-[90px_1fr] gap-y-2">
              <dt className="text-mr-muted">Contact</dt>
              <dd>{party.contact_name || "—"}</dd>
              <dt className="text-mr-muted">Phone</dt>
              <dd>{party.phone || "—"}</dd>
              <dt className="text-mr-muted">Email</dt>
              <dd className="break-all">{party.email || "—"}</dd>
              <dt className="text-mr-muted">Address</dt>
              <dd>{party.address || "—"}</dd>
              <dt className="text-mr-muted">Currency</dt>
              <dd>{party.default_currency}</dd>
              <dt className="text-mr-muted">Terms</dt>
              <dd>{party.payment_terms || "—"}</dd>
            </dl>
            {party.notes && <p className="whitespace-pre-wrap border-t border-mr-line pt-3 text-mr-body">{party.notes}</p>}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
