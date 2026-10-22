import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { Attribution } from "@/components/shell/attribution";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusPill, TRAVELLER_TONES } from "@/components/shared/status-pill";
import { DocumentSlots, type DocView } from "@/components/travel/document-slots";
import { TravellerForm } from "@/components/travel/traveller-form";
import { CompilePackButton, PackHistory } from "@/components/travel/pack-panel";
import { TravellerStatusSelect } from "@/components/travel/traveller-status-select";
import { createClient } from "@/lib/supabase/server";
import { docCompleteness, groupCoverage, groupTitle } from "@/lib/queries/travel";
import { loadSuggestionInputs } from "@/lib/queries/suggestions";
import { suggestForTraveller } from "@/lib/travel/suggestions";
import { GroupSuggestions } from "@/components/travel/group-suggestions";
import { ApplicationActions } from "@/components/travel/application-actions";
import { Chip } from "@/components/shared/chip";
import { PORTAL_STATUSES } from "@/lib/constants";
import { todayISO } from "@/lib/format";
import { DeleteTravellerButton } from "@/components/travel/delete-traveller-button";
import { BUCKETS, TRAVELLER_STATUSES, labelFor } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import type { TravellerInput } from "@/lib/validation/travel";

export const metadata: Metadata = { title: "Traveller" };

export default async function TravellerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: t } = await supabase
    .from("travellers")
    .select(
      "*, creator:profiles!travellers_created_by_fkey(display_name), group:travel_groups(id, travel_date, travel_end_date, group_code, label, guide_name, reference_prefix, entry_port, exit_port, travellers(count), group_documents(doc_type, deleted_at)), lead:leads(id, lead_ref, full_name), invoice:invoices(id, invoice_number)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!t) notFound();

  const [{ data: docs }, { data: packs }] = await Promise.all([
    supabase
      .from("traveller_documents")
      .select("id, doc_type, file_name, file_size, mime_type, storage_path, uploaded_at, uploader:profiles!traveller_documents_uploaded_by_fkey(display_name)")
      .eq("traveller_id", id)
      .is("deleted_at", null)
      .order("merge_order")
      .order("uploaded_at"),
    supabase
      .from("travel_packs")
      .select("id, generated_at, page_count, included_doc_ids, generator:profiles!travel_packs_generated_by_fkey(display_name)")
      .eq("traveller_id", id)
      .order("generated_at", { ascending: false }),
  ]);

  // Signed thumbnails for image documents (1 hour).
  const imagePaths = (docs ?? []).filter((d) => d.mime_type.startsWith("image/")).map((d) => d.storage_path);
  const signed = imagePaths.length
    ? (await supabase.storage.from(BUCKETS.travellerDocuments).createSignedUrls(imagePaths, 3600)).data ?? []
    : [];
  const urlByPath = new Map(signed.map((s) => [s.path, s.signedUrl] as const));

  const documents: DocView[] = (docs ?? []).map((d) => ({
    id: d.id,
    doc_type: d.doc_type,
    file_name: d.file_name,
    file_size: d.file_size,
    mime_type: d.mime_type,
    uploaded_at: d.uploaded_at,
    uploaded_by_name: d.uploader?.display_name ?? null,
    preview_url: urlByPath.get(d.storage_path) ?? null,
  }));
  const groupCovered = [...groupCoverage(t.group?.group_documents)];
  // Ungrouped upcoming traveller: suggest a group to merge into or a travel mate to pair with (group visa needs 2+).
  const wantsSuggestions = !t.travel_group_id && t.status !== "cancelled" && t.status !== "travelled" && t.travel_start_date >= todayISO();
  const suggestions = wantsSuggestions ? await loadSuggestionInputs(supabase).then((inp) => suggestForTraveller({ id: t.id, full_name: t.full_name, traveller_ref: t.traveller_ref, travel_start_date: t.travel_start_date, travel_end_date: t.travel_end_date }, inp.groups, inp.ungrouped)) : [];
  const completeness = docCompleteness((docs ?? []).map((d) => ({ doc_type: d.doc_type, deleted_at: null })), new Set(groupCovered));

  const defaults: TravellerInput = {
    full_name: t.full_name,
    phone: t.phone ?? "",
    email: t.email ?? "",
    passport_number: t.passport_number ?? "",
    nationality: t.nationality ?? "",
    travel_start_date: t.travel_start_date,
    travel_end_date: t.travel_end_date,
    travel_group_id: t.travel_group_id,
    visa_reference: t.visa_reference ?? "",
    status: t.status,
    package_tier: t.package_tier,
    hotel_name: t.hotel_name,
    hotel_stars: t.hotel_stars,
    transit_location: t.transit_location,
    notes: t.notes ?? "",
    lead_id: t.lead_id,
    invoice_id: t.invoice_id,
    customer_id: t.customer_id,
    address: t.address ?? "",
    pan_number: t.pan_number ?? "",
    date_of_birth: t.date_of_birth ?? "",
    sex: t.sex,
    passport_expiry: t.passport_expiry ?? "",
  };

  const initialGroup = t.group
    ? {
        id: t.group.id,
        travel_date: t.group.travel_date,
        travel_end_date: t.group.travel_end_date,
        group_code: t.group.group_code,
        label: t.group.label,
        guide_name: t.group.guide_name,
        reference_prefix: t.group.reference_prefix,
        traveller_count: Array.isArray(t.group.travellers) ? Number(t.group.travellers[0]?.count ?? 0) : 0,
      }
    : null;

  return (
    <>
      <PageHeader
        title={t.full_name}
        description={`${t.traveller_ref} · ${formatDate(t.travel_start_date)} – ${formatDate(t.travel_end_date)}${t.group ? ` · ${groupTitle(t.group)}` : ""}`}
        actions={
          <>
            <DeleteTravellerButton travellerId={t.id} travellerName={t.full_name} />
            <CompilePackButton travellerId={t.id} missing={completeness.missingLabels} available={[...new Set(documents.map((d) => d.doc_type))]} />
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <StatusPill label={labelFor(TRAVELLER_STATUSES, t.status)} tone={TRAVELLER_TONES[t.status]} />
        <TravellerStatusSelect travellerId={t.id} status={t.status} />
        {t.visa_reference && <span className="font-mono text-xs text-mr-body">{t.visa_reference}</span>}
        {t.source === "b2c_portal" && (
          <>
            <Chip tone="ink">Customer portal</Chip>
            <Chip tone={t.portal_status === "submitted" ? "warning" : t.portal_status === "reviewed" ? "success" : "muted"}>{labelFor(PORTAL_STATUSES, t.portal_status ?? "draft")}</Chip>
            {t.portal_status !== "draft" && <Chip tone={t.portal_ready ? "ink" : "neutral"}>{t.portal_ready ? "Has PAR + hotel" : "Needs PAR / hotel"}</Chip>}
          </>
        )}
        <Attribution name={t.creator?.display_name} date={t.created_at} />
      </div>
      {t.source === "b2c_portal" && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <ApplicationActions travellerId={t.id} portalStatus={t.portal_status} token={t.portal_token} missing={[]} />
        </div>
      )}
      {wantsSuggestions && (
        <section className="mb-6">
          <h2 className="micro-label mb-2">Group suggestion</h2>
          <GroupSuggestions travellerId={t.id} suggestions={suggestions} />
        </section>
      )}

      <section className="mb-8">
        <h2 className="micro-label mb-3">Documents</h2>
        <DocumentSlots travellerId={t.id} documents={documents} groupCovered={groupCovered} />
      </section>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section>
          <h2 className="micro-label mb-3">Details</h2>
          <TravellerForm mode="edit" travellerId={t.id} defaultValues={defaults} initialGroup={initialGroup} />
        </section>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Travel packs</CardTitle>
            </CardHeader>
            <CardContent>
              <PackHistory
                packs={(packs ?? []).map((p) => ({
                  id: p.id,
                  generated_at: p.generated_at,
                  generated_by_name: p.generator?.display_name ?? null,
                  page_count: p.page_count,
                  included_count: p.included_doc_ids?.length ?? 0,
                }))}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Linked records</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {t.lead ? (
                <Link href={`/leads/${t.lead.id}`} className="block hover:underline">
                  <span className="font-medium">{t.lead.full_name}</span>
                  <span className="ml-2 text-mr-muted">{t.lead.lead_ref}</span>
                </Link>
              ) : (
                <p className="text-mr-muted">No linked lead.</p>
              )}
              {t.invoice ? (
                <Link href={`/invoices/${t.invoice.id}`} className="block hover:underline">
                  <span className="font-medium">{t.invoice.invoice_number}</span>
                </Link>
              ) : (
                <p className="text-mr-muted">No linked invoice.</p>
              )}
              {t.group && (
                <Link href={`/travel?date=${t.group.travel_date}`} className="block hover:underline">
                  <span className="font-medium">{groupTitle(t.group)}</span>
                  {t.group.guide_name && <span className="ml-2 text-mr-muted">Guide: {t.group.guide_name}</span>}
                  {(t.group.entry_port || t.group.exit_port) && (
                    <span className="block text-xs text-mr-muted">
                      In: {t.group.entry_port ?? "—"} · Out: {t.group.exit_port ?? "—"}
                    </span>
                  )}
                </Link>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
