import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { InvoiceForm } from "@/components/invoices/invoice-form";
import { createClient } from "@/lib/supabase/server";
import type { InvoiceInput } from "@/lib/validation/invoice";

export const metadata: Metadata = { title: "Edit invoice" };

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: invoice } = await supabase.from("invoices").select("*, invoice_items(*)").eq("id", id).maybeSingle();
  if (!invoice) notFound();

  const defaults: InvoiceInput = {
    issue_date: invoice.issue_date,
    due_date_label: invoice.due_date_label ?? "On Receipt",
    currency: invoice.currency,
    bill_to_name: invoice.bill_to_name,
    bill_to_phone: invoice.bill_to_phone ?? "",
    bill_to_email: invoice.bill_to_email ?? "",
    bill_to_address: invoice.bill_to_address ?? "",
    visa_reference: invoice.visa_reference ?? "",
    tax: Number(invoice.tax),
    amount_in_words_override: "",
    terms: invoice.terms ?? "",
    status: invoice.status,
    lead_id: invoice.lead_id,
    customer_id: invoice.customer_id,
    items: [...invoice.invoice_items]
      .sort((a, b) => a.position - b.position)
      .map((it) => ({
        id: it.id,
        title: it.title,
        description: it.description ?? "",
        reference: it.reference ?? "",
        quantity: Number(it.quantity),
        rate: Number(it.rate),
      })),
  };

  return (
    <>
      <PageHeader title={`Edit ${invoice.invoice_number}`} description="Saving replaces the stored PDF on next download." />
      <InvoiceForm mode="edit" invoiceId={invoice.id} invoiceNumber={invoice.invoice_number} defaultValues={defaults} />
    </>
  );
}
