import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { Attribution } from "@/components/shell/attribution";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusPill, LEAD_TONES, INVOICE_TONES, TRAVELLER_TONES } from "@/components/shared/status-pill";
import { LeadForm } from "@/components/leads/lead-form";
import { LeadStatusActions } from "@/components/leads/lead-status-actions";
import { ActivityTimeline, AddActivity } from "@/components/leads/activity-timeline";
import { createClient } from "@/lib/supabase/server";
import { INVOICE_STATUSES, LEAD_STATUSES, LOST_REASONS, TRAVELLER_STATUSES, labelFor } from "@/lib/constants";
import { formatDate, formatMoney } from "@/lib/format";
import type { LeadInput } from "@/lib/validation/lead";

export const metadata: Metadata = { title: "Lead" };

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: lead } = await supabase
    .from("leads")
    .select("*, creator:profiles!leads_created_by_fkey(display_name)")
    .eq("id", id)
    .maybeSingle();
  if (!lead) notFound();

  const [{ data: profiles }, { data: activities }, { data: invoices }, { data: travellers }] = await Promise.all([
    supabase.from("profiles").select("id, display_name").order("display_name"),
    supabase
      .from("lead_activities")
      .select("id, activity_type, body, old_status, new_status, created_at, author:profiles!lead_activities_created_by_fkey(display_name)")
      .eq("lead_id", id)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("invoices").select("id, invoice_number, total, currency, status, issue_date").eq("lead_id", id).order("sequence_number", { ascending: false }),
    supabase.from("travellers").select("id, traveller_ref, full_name, status, travel_start_date").eq("lead_id", id),
  ]);

  const defaults: LeadInput = {
    full_name: lead.full_name,
    phone: lead.phone,
    email: lead.email ?? "",
    country: lead.country,
    city: lead.city ?? "",
    entry_city: lead.entry_city ?? "",
    enquiry_type: lead.enquiry_type,
    source: lead.source,
    status: lead.status,
    pax_count: lead.pax_count ?? 1,
    travel_month: lead.travel_month ?? "",
    canton_phase: lead.canton_phase,
    package_tier: lead.package_tier,
    quoted_amount: lead.quoted_amount == null ? "" : Number(lead.quoted_amount),
    quoted_currency: lead.quoted_currency ?? "USD",
    assigned_to: lead.assigned_to,
    next_followup_date: lead.next_followup_date,
    notes: lead.notes ?? "",
  };

  return (
    <>
      <PageHeader
        title={lead.full_name}
        description={`${lead.lead_ref} · ${lead.phone}`}
        actions={<LeadStatusActions lead={{ id: lead.id, full_name: lead.full_name, status: lead.status }} />}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <StatusPill label={labelFor(LEAD_STATUSES, lead.status)} tone={LEAD_TONES[lead.status]} />
        {lead.status === "lost" && lead.lost_reason && (
          <span className="text-sm text-mr-body">Lost: {labelFor(LOST_REASONS, lead.lost_reason)}</span>
        )}
        <Attribution name={lead.creator?.display_name} date={lead.created_at} />
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div>
          <LeadForm mode="edit" leadId={lead.id} defaultValues={defaults} profiles={profiles ?? []} compact />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <AddActivity leadId={lead.id} />
              <ActivityTimeline
                activities={(activities ?? []).map((a) => ({
                  id: a.id,
                  activity_type: a.activity_type,
                  body: a.body,
                  old_status: a.old_status,
                  new_status: a.new_status,
                  created_at: a.created_at,
                  author_name: a.author?.display_name ?? null,
                }))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              {invoices && invoices.length > 0 ? (
                <ul className="divide-y divide-mr-line text-sm">
                  {invoices.map((inv) => (
                    <li key={inv.id} className="flex items-center justify-between gap-2 py-2">
                      <Link href={`/invoices/${inv.id}`} className="font-medium hover:underline">
                        {inv.invoice_number}
                      </Link>
                      <span className="tnum text-mr-body">{formatMoney(inv.total, inv.currency)}</span>
                      <StatusPill label={labelFor(INVOICE_STATUSES, inv.status)} tone={INVOICE_TONES[inv.status]} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-mr-muted">No invoices linked.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Travellers</CardTitle>
            </CardHeader>
            <CardContent>
              {travellers && travellers.length > 0 ? (
                <ul className="divide-y divide-mr-line text-sm">
                  {travellers.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-2 py-2">
                      <Link href={`/travel/travellers/${t.id}`} className="font-medium hover:underline">
                        {t.full_name}
                      </Link>
                      <span className="tnum text-mr-body">{formatDate(t.travel_start_date)}</span>
                      <StatusPill label={labelFor(TRAVELLER_STATUSES, t.status)} tone={TRAVELLER_TONES[t.status]} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-mr-muted">No traveller records yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
