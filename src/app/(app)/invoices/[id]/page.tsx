import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Pencil } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Attribution } from "@/components/shell/attribution";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusPill, INVOICE_TONES } from "@/components/shared/status-pill";
import { A4Preview } from "@/components/shared/a4-preview";
import { InvoiceActionsMenu } from "@/components/invoices/invoice-actions";
import { RecordReceiptButton } from "@/components/accounts/receipt-dialog";
import { MarkPaidButton } from "@/components/invoices/mark-paid-button";
import { Amount } from "@/components/accounts/money";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isAdmin } from "@/lib/auth";
import { renderInvoiceHtml } from "@/lib/pdf/invoice-template";
import { previewTemplateAssets } from "@/lib/pdf/preview-assets";
import { invoiceToTemplateData } from "@/lib/invoice/template-data";
import { INVOICE_STATUSES, PAYMENT_METHODS, labelFor } from "@/lib/constants";
import { formatDate, formatMoney } from "@/lib/format";

export const metadata: Metadata = { title: "Invoice" };

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const current = await getCurrentProfile();
  const admin = isAdmin(current?.profile);
  const { data: invoice } = await supabase
    .from("invoices")
    .select("*, invoice_items(*), creator:profiles!invoices_created_by_fkey(display_name), lead:leads(id, lead_ref, full_name), deal:deals(id, deal_ref, title), group:travel_groups!invoices_travel_group_id_fkey(id, group_ref, travel_date, label)")
    .eq("id", id)
    .maybeSingle();
  if (!invoice) notFound();

  const [{ data: travellers }, { data: receipts }] = await Promise.all([
    supabase.from("travellers").select("id, traveller_ref, full_name").eq("invoice_id", id),
    admin
      ? supabase
          .from("receipts")
          .select("id, receipt_ref, received_on, amount, currency, applied_amount, method, reference, ledger:bank_accounts(name)")
          .eq("invoice_id", id)
          .order("received_on", { ascending: false })
      : Promise.resolve({ data: null }),
  ]);
  // Received / balance come from the payment summary (works for every role); admins also see the receipt lines.
  const { data: summary } = await supabase.rpc("invoice_payment_summary", { p_ids: [id] });
  const receivedRaw = invoice.status === "paid" ? Number(invoice.total) : Number(summary?.[0]?.received ?? 0);
  const received = Math.min(Number(invoice.total), receivedRaw);
  const balance = Math.max(0, Math.round((Number(invoice.total) - received) * 100) / 100);

  const html = renderInvoiceHtml(invoiceToTemplateData(invoice, invoice.invoice_items, invoice.group?.group_ref), previewTemplateAssets());

  return (
    <>
      <PageHeader
        title={invoice.invoice_number}
        description={`${invoice.bill_to_name} · ${formatDate(invoice.issue_date)}`}
        actions={
          <>
            <Link href={`/invoices/${invoice.id}/edit`} className={buttonVariants({ variant: "outline" })}>
              <Pencil /> Edit
            </Link>
            <a href={`/api/invoices/${invoice.id}/pdf`} className={buttonVariants()}>
              <Download /> Download PDF
            </a>
            <InvoiceActionsMenu invoice={{ ...invoice, balance }} showView={false} />
          </>
        }
      />

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
        <A4Preview html={html} />

        <div className="space-y-4 xl:order-last">
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-mr-body">Status</span>
                <StatusPill label={labelFor(INVOICE_STATUSES, invoice.status)} tone={INVOICE_TONES[invoice.status]} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-mr-body">Total</span>
                <span className="tnum font-medium">{formatMoney(invoice.total, invoice.currency)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-mr-body">Due</span>
                <span>{invoice.due_date_label}</span>
              </div>
              {invoice.group && (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-mr-body">Group</span>
                  <Link href={`/travel?date=${invoice.group.travel_date}`} className="truncate font-mono text-xs text-mr-ink hover:underline">
                    {invoice.group.group_ref ?? invoice.group.label ?? "Open"}
                  </Link>
                </div>
              )}
              {invoice.visa_reference && (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-mr-body">Visa ref</span>
                  <span className="truncate font-mono text-xs">{invoice.visa_reference}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-mr-body">PDF</span>
                <span className="text-xs text-mr-muted">{invoice.pdf_path ? "Stored" : "Generated on first download"}</span>
              </div>
              <div className="border-t border-mr-line pt-3">
                <Attribution name={invoice.creator?.display_name} date={invoice.created_at} />
              </div>
            </CardContent>
          </Card>

          <Card>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center justify-between gap-2">
                  <span>Payments</span>
                  {invoice.status === "issued" && balance > 0 && <MarkPaidButton size="sm" label="Record payment" invoiceId={invoice.id} invoiceNumber={invoice.invoice_number} balance={balance} currency={invoice.currency} />}
                  {admin && invoice.status !== "cancelled" && balance > 0 && (
                    <RecordReceiptButton
                      size="sm"
                      variant="ghost"
                      label="Record in Accounts"
                      invoice={{
                        id: invoice.id,
                        invoice_number: invoice.invoice_number,
                        bill_to_name: invoice.bill_to_name,
                        issue_date: invoice.issue_date,
                        total: Number(invoice.total),
                        currency: invoice.currency,
                        status: invoice.status,
                        deal_id: invoice.deal_id,
                        received,
                        balance,
                      }}
                    />
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-mr-body">Received</span>
                  <Amount value={received} currency={invoice.currency} className="font-medium text-mr-success" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-mr-body">Balance</span>
                  <Amount value={balance} currency={invoice.currency} className={balance > 0 && invoice.status === "issued" ? "font-medium text-mr-red" : "font-medium"} />
                </div>
                {receipts && receipts.length > 0 && (
                  <ul className="divide-y divide-mr-line border-t border-mr-line pt-1">
                    {receipts.map((r) => (
                      <li key={r.id} className="flex items-center gap-2 py-2">
                        <span className="tnum w-20 shrink-0 text-xs text-mr-muted">{formatDate(r.received_on)}</span>
                        <span className="min-w-0 flex-1 truncate text-xs text-mr-body">
                          {r.receipt_ref} · {labelFor(PAYMENT_METHODS, r.method)}
                          {r.ledger?.name ? ` · ${r.ledger.name}` : ""}
                        </span>
                        <Amount value={r.amount} currency={r.currency} className="text-xs font-medium" />
                      </li>
                    ))}
                  </ul>
                )}
                {admin && (!receipts || receipts.length === 0) && <p className="text-xs text-mr-muted">No payments recorded. Recording one here also updates Accounts.</p>}
                {!admin && received > 0 && invoice.status !== "paid" && <p className="text-xs text-mr-muted">Part payment recorded. The receipt lines are under Accounts.</p>}
              </CardContent>
            </Card>

          <Card>
            <CardHeader>
              <CardTitle>Linked records</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {admin && invoice.deal && (
                <Link href={`/accounts/deals/${invoice.deal.id}`} className="block hover:underline">
                  <span className="font-medium">{invoice.deal.deal_ref}</span>
                  <span className="ml-2 text-mr-muted">{invoice.deal.title}</span>
                </Link>
              )}
              {invoice.lead ? (
                <Link href={`/leads/${invoice.lead.id}`} className="block hover:underline">
                  <span className="font-medium">{invoice.lead.full_name}</span>
                  <span className="ml-2 text-mr-muted">{invoice.lead.lead_ref}</span>
                </Link>
              ) : (
                <p className="text-mr-muted">No linked lead.</p>
              )}
              {travellers && travellers.length > 0 ? (
                travellers.map((t) => (
                  <Link key={t.id} href={`/travel/travellers/${t.id}`} className="block hover:underline">
                    <span className="font-medium">{t.full_name}</span>
                    <span className="ml-2 text-mr-muted">{t.traveller_ref}</span>
                  </Link>
                ))
              ) : (
                <p className="text-mr-muted">No linked travellers.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
