import { NextResponse } from "next/server";
import { formatInTimeZone } from "date-fns-tz";
import { createClient } from "@/lib/supabase/server";
import { launchBrowser } from "@/lib/pdf/browser";
import { buildGroupPackPdf, type PackSource } from "@/lib/pdf/travel-pack";
import { groupPackReference } from "@/lib/queries/travel";
import { BUCKETS, DOC_TYPES, TIMEZONE, labelFor } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/groups/:id/packs -> { url, file_name, page_count, count, warnings }
 * Builds ONE merged PDF for the group (group cover, then every traveller's
 * documents in PAR, passport, flight, hotel order), named like
 * MR144-Aug25-Aug30-05px-G01.pdf, stores it in the travel-packs bucket and
 * returns a signed download URL.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { data: group } = await supabase
    .from("travel_groups")
    .select(
      "id, travel_date, travel_end_date, group_code, label, guide_name, reference_prefix, travellers(id, traveller_ref, full_name, passport_number, nationality, travel_start_date, travel_end_date, visa_reference, status, traveller_documents(id, doc_type, file_name, storage_path, mime_type, merge_order, uploaded_at, deleted_at))",
    )
    .eq("id", id)
    .maybeSingle();
  if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });

  const travellers = [...group.travellers]
    .filter((t) => t.status !== "cancelled")
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
  if (travellers.length === 0) return NextResponse.json({ error: "This group has no travellers" }, { status: 400 });

  let browser;
  const warnings: string[] = [];
  try {
    // Download every active document up front, in merge order.
    const inputs = [];
    for (const t of travellers) {
      const docs = t.traveller_documents
        .filter((d) => !d.deleted_at)
        .sort((a, b) => a.merge_order - b.merge_order || (a.uploaded_at ?? "").localeCompare(b.uploaded_at ?? ""));
      const sources: PackSource[] = [];
      for (const d of docs) {
        const { data: blob, error } = await supabase.storage.from(BUCKETS.travellerDocuments).download(d.storage_path);
        if (error || !blob) {
          warnings.push(`${t.full_name}: ${labelFor(DOC_TYPES, d.doc_type)} (${d.file_name}) skipped: ${error?.message ?? "download failed"}`);
          continue;
        }
        sources.push({ docId: d.id, docType: d.doc_type, fileName: d.file_name, mimeType: d.mime_type, bytes: new Uint8Array(await blob.arrayBuffer()) });
      }
      inputs.push({
        traveller: {
          id: t.id,
          traveller_ref: t.traveller_ref,
          full_name: t.full_name,
          passport_number: t.passport_number,
          nationality: t.nationality,
          travel_start_date: t.travel_start_date,
          travel_end_date: t.travel_end_date,
          visa_reference: t.visa_reference,
          group_code: group.group_code,
          group_label: group.label,
        },
        sources,
      });
    }

    const reference = groupPackReference(group, travellers.length);
    browser = await launchBrowser();
    const built = await buildGroupPackPdf(browser, {
      reference,
      group_code: group.group_code,
      label: group.label,
      guide_name: group.guide_name,
      travel_start_date: group.travel_date,
      travel_end_date: group.travel_end_date,
      travellers: inputs,
    });
    warnings.push(...built.warnings);

    const fileName = `${reference}.pdf`;
    const stamp = formatInTimeZone(new Date(), TIMEZONE, "yyyyMMdd-HHmmss");
    const storagePath = `_groups/${group.id}/${stamp}/${fileName}`;
    const { error: upError } = await supabase.storage
      .from(BUCKETS.travelPacks)
      .upload(storagePath, Buffer.from(built.bytes), { contentType: "application/pdf", upsert: false });
    if (upError) throw new Error(`Upload failed: ${upError.message}`);

    const { data: signed, error: signError } = await supabase.storage
      .from(BUCKETS.travelPacks)
      .createSignedUrl(storagePath, 300, { download: fileName });
    if (signError || !signed) throw new Error("Could not create download link");

    return NextResponse.json({ url: signed.signedUrl, file_name: fileName, page_count: built.pageCount, count: travellers.length, warnings });
  } catch (e) {
    console.error("group pack failed", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Compilation failed", warnings }, { status: 500 });
  } finally {
    await browser?.close().catch(() => undefined);
  }
}
