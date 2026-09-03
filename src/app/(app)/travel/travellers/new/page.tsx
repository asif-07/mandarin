import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { TravellerForm } from "@/components/travel/traveller-form";
import { createClient } from "@/lib/supabase/server";
import type { TravellerInput } from "@/lib/validation/travel";
import { COUNTRIES } from "@/lib/constants";

export const metadata: Metadata = { title: "New traveller" };

const NATIONALITY_BY_COUNTRY: Record<string, string> = {
  UAE: "Emirati",
  India: "Indian",
  "Saudi Arabia": "Saudi",
  Qatar: "Qatari",
  Oman: "Omani",
  Kuwait: "Kuwaiti",
  Bahrain: "Bahraini",
};

export default async function NewTravellerPage({ searchParams }: { searchParams: Promise<{ lead?: string }> }) {
  const { lead: leadId } = await searchParams;
  let defaults: Partial<TravellerInput> | undefined;
  let linkedLead: { lead_ref: string; full_name: string } | null = null;
  let linkedInvoice: { invoice_number: string } | null = null;

  if (leadId) {
    const supabase = await createClient();
    const [{ data: lead }, { data: invoice }] = await Promise.all([
      supabase.from("leads").select("id, lead_ref, full_name, phone, email, country, customer_id, notes").eq("id", leadId).maybeSingle(),
      supabase
        .from("invoices")
        .select("id, invoice_number, visa_reference")
        .eq("lead_id", leadId)
        .neq("status", "cancelled")
        .order("sequence_number", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (lead) {
      linkedLead = { lead_ref: lead.lead_ref, full_name: lead.full_name };
      defaults = {
        full_name: lead.full_name,
        phone: lead.phone,
        email: lead.email ?? "",
        nationality: lead.country && COUNTRIES.some((c) => c.value === lead.country) ? (NATIONALITY_BY_COUNTRY[lead.country] ?? "") : "",
        lead_id: lead.id,
        customer_id: lead.customer_id,
        invoice_id: invoice?.id ?? null,
        visa_reference: invoice?.visa_reference ?? "",
      };
      if (invoice) linkedInvoice = { invoice_number: invoice.invoice_number };
    }
  }

  return (
    <>
      <PageHeader title="New traveller" description="Create the record, then upload the four documents on the next screen." />
      <div className="max-w-3xl">
        <TravellerForm mode="create" defaultValues={defaults} linkedLead={linkedLead} linkedInvoice={linkedInvoice} />
      </div>
    </>
  );
}
