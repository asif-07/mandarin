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
import { createClient } from "@/lib/supabase/server";
import { renderInvoiceHtml } from "@/lib/pdf/invoice-template";
import { previewTemplateAssets } from "@/lib/pdf/preview-assets";
import { invoiceToTemplateData } from "@/lib/invoice/template-data";
import { INVOICE_STATUSES, labelFor } from "@/lib/constants";
import { formatDate, formatMoney } from "@/lib/format";

export const metadata: Metadata = { title: "Invoice" };

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: invoice } = await supabase
    .from("invoices")
    .select("*, invoice_items(*), creator:profiles!invoices_created_by_fkey(display_name), lead:leads(id, lead_ref, full_name)")
    .eq("id", id)
    .maybeSingle();
  if (!invoice) notFound();

  const { data: travellers } = await supabase
    .from("travellers")
    .select("id, traveller_ref, full_name")
    .eq("invoice_id", id);

  const html = renderInvoiceHtml(invoiceToTemplateData(invoice, invoice.invoice_items), previewTemplateAssets());

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
            <InvoiceActionsMenu invoice={invoice} showView={false} />
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
              <CardTitle>Linked records</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
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
