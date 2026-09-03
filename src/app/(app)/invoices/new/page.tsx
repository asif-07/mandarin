import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { InvoiceForm } from "@/components/invoices/invoice-form";
import { peekNextInvoiceNumber } from "@/lib/actions/invoices";
import { createClient } from "@/lib/supabase/server";
import type { InvoiceInput } from "@/lib/validation/invoice";

export const metadata: Metadata = { title: "New invoice" };

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ lead?: string }> }) {
  const { lead: leadId } = await searchParams;
  const nextNumber = await peekNextInvoiceNumber();

  let defaults: Partial<InvoiceInput> | undefined;
  if (leadId) {
    const supabase = await createClient();
    const { data: lead } = await supabase
      .from("leads")
      .select("id, customer_id, full_name, phone, email, city, country, quoted_amount, quoted_currency")
      .eq("id", leadId)
      .maybeSingle();
    if (lead) {
      defaults = {
        lead_id: lead.id,
        customer_id: lead.customer_id,
        bill_to_name: lead.full_name,
        bill_to_phone: lead.phone,
        bill_to_email: lead.email ?? "",
        bill_to_address: [lead.city, lead.country].filter(Boolean).join(", "),
        currency: lead.quoted_currency ?? "USD",
      };
    }
  }

  return (
    <>
      <PageHeader title="New invoice" description={`Will be numbered ${nextNumber} when saved.`} />
      <InvoiceForm mode="create" nextInvoiceNumber={nextNumber} defaultValues={defaults} />
    </>
  );
}
