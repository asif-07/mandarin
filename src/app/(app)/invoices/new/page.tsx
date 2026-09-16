import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { InvoiceForm } from "@/components/invoices/invoice-form";
import { peekNextInvoiceNumber } from "@/lib/actions/invoices";
import { createClient } from "@/lib/supabase/server";
import type { InvoiceInput } from "@/lib/validation/invoice";

export const metadata: Metadata = { title: "New invoice" };

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ lead?: string; group?: string }> }) {
  const { lead: leadId, group: groupId } = await searchParams;
  const nextNumber = await peekNextInvoiceNumber();

  let defaults: Partial<InvoiceInput> | undefined;
  let initialGroup = null;
  if (groupId) {
    const supabase = await createClient();
    const { data: g } = await supabase.from("travel_groups").select("id, travel_date, travel_end_date, group_code, label, guide_name, reference_prefix, entry_port, exit_port, source, partner_code, pax_expected, group_ref, travellers(count)").eq("id", groupId).maybeSingle();
    if (g) {
      initialGroup = { ...g, traveller_count: Array.isArray(g.travellers) ? Number(g.travellers[0]?.count ?? 0) : 0 };
      defaults = { travel_group_id: g.id, visa_reference: g.group_ref ?? "" };
    }
  }
  if (leadId) {
    const supabase = await createClient();
    const { data: lead } = await supabase
      .from("leads")
      .select("id, customer_id, full_name, phone, email, city, country, quoted_amount, quoted_currency")
      .eq("id", leadId)
      .maybeSingle();
    if (lead) {
      defaults = {
        ...defaults,
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
      <InvoiceForm mode="create" nextInvoiceNumber={nextNumber} defaultValues={defaults} initialGroup={initialGroup} />
    </>
  );
}
