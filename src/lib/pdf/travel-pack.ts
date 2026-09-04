import { PDFDocument, PageSizes } from "pdf-lib";
import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Browser } from "puppeteer-core";
import { formatInTimeZone } from "date-fns-tz";
import type { Database } from "@/types/database";
import { renderPdfWithBrowser } from "@/lib/pdf/browser";
import { loadTemplateAssets } from "@/lib/pdf/assets";
import { renderCoverHtml, renderGroupCoverHtml } from "@/lib/pdf/cover-template";
import { BUCKETS, DOC_TYPES, REQUIRED_DOC_TYPES, TIMEZONE, labelFor } from "@/lib/constants";

const [A4_W, A4_H] = PageSizes.A4;
const MARGIN = 36; // 0.5in

export type PackTraveller = {
  id: string;
  traveller_ref: string;
  full_name: string;
  passport_number: string | null;
  nationality: string | null;
  travel_start_date: string;
  travel_end_date: string;
  visa_reference: string | null;
  group_code: string | null;
  group_label: string | null;
};

export type PackSource = {
  docId: string;
  docType: string;
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
};

export type BuiltPack = {
  bytes: Uint8Array;
  pageCount: number;
  includedDocIds: string[];
  warnings: string[];
};

/** Convert a JPG/PNG to a single A4 page, fitted inside margins, aspect preserved. */
export async function imageToPdfPage(pdf: PDFDocument, bytes: Uint8Array): Promise<void> {
  // sharp normalises orientation (EXIF rotate) and caps the longest edge so packs stay small.
  const jpeg = await sharp(bytes)
    .rotate()
    .resize({ width: 2200, height: 2200, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
  const image = await pdf.embedJpg(jpeg);
  const maxW = A4_W - MARGIN * 2;
  const maxH = A4_H - MARGIN * 2;
  const scale = Math.min(maxW / image.width, maxH / image.height);
  const w = image.width * scale;
  const h = image.height * scale;
  const page = pdf.addPage([A4_W, A4_H]);
  page.drawImage(image, { x: (A4_W - w) / 2, y: (A4_H - h) / 2, width: w, height: h });
}

/**
 * Pure builder: cover page + documents (already downloaded) merged into one
 * PDF with metadata. No storage or database access, so it is unit-testable.
 */
export async function buildTravelPackPdf(browser: Browser, traveller: PackTraveller, sources: PackSource[]): Promise<BuiltPack> {
  const warnings: string[] = [];
  const parts: { docId: string; label: string; fileName: string; doc: PDFDocument }[] = [];

  for (const s of sources) {
    const label = labelFor(DOC_TYPES, s.docType);
    try {
      let doc: PDFDocument;
      if (s.mimeType === "application/pdf") {
        doc = await PDFDocument.load(s.bytes, { ignoreEncryption: true });
      } else {
        doc = await PDFDocument.create();
        await imageToPdfPage(doc, s.bytes);
      }
      parts.push({ docId: s.docId, label, fileName: s.fileName, doc });
    } catch (e) {
      warnings.push(`${label} (${s.fileName}) skipped: ${e instanceof Error ? e.message : "unreadable"}`);
    }
  }

  const present = new Set(sources.map((s) => s.docType));
  const missing = REQUIRED_DOC_TYPES.filter((r) => !present.has(r)).map((r) => labelFor(DOC_TYPES, r));

  const assets = await loadTemplateAssets();
  const coverHtml = renderCoverHtml(
    {
      ...traveller,
      generated_at: new Date(),
      contents: parts.map((p) => ({ label: p.label, file_name: p.fileName, pages: p.doc.getPageCount() })),
      missing,
    },
    assets,
  );
  const coverPdf = await PDFDocument.load(await renderPdfWithBrowser(browser, coverHtml));

  const merged = await PDFDocument.create();
  for (const page of await merged.copyPages(coverPdf, coverPdf.getPageIndices())) merged.addPage(page);
  for (const p of parts) {
    for (const page of await merged.copyPages(p.doc, p.doc.getPageIndices())) merged.addPage(page);
  }

  merged.setTitle(`${traveller.traveller_ref} - ${traveller.full_name} - Travel Pack`);
  merged.setAuthor("Mandarin Roots");
  merged.setSubject("Travel document pack");
  merged.setCreator("Mandarin Roots operations platform");
  merged.setProducer("pdf-lib");
  merged.setCreationDate(new Date());
  merged.setModificationDate(new Date());

  return {
    bytes: await merged.save(),
    pageCount: merged.getPageCount(),
    includedDocIds: parts.map((p) => p.docId),
    warnings,
  };
}

export type GroupPackInput = {
  reference: string;
  group_code: string;
  label: string | null;
  guide_name: string | null;
  travel_start_date: string;
  travel_end_date: string;
  travellers: { traveller: PackTraveller; sources: PackSource[] }[];
};

/**
 * One merged PDF for a whole group: a group cover listing every traveller,
 * then each traveller's section (their own cover, then PAR, passport, flight
 * ticket, hotel booking and any extras, in merge order).
 */
export async function buildGroupPackPdf(browser: Browser, input: GroupPackInput): Promise<BuiltPack> {
  const warnings: string[] = [];
  const sections: { traveller: PackTraveller; built: BuiltPack; sources: PackSource[] }[] = [];

  for (const t of input.travellers) {
    const built = await buildTravelPackPdf(browser, t.traveller, t.sources);
    warnings.push(...built.warnings.map((w) => `${t.traveller.full_name}: ${w}`));
    sections.push({ traveller: t.traveller, built, sources: t.sources });
  }

  const assets = await loadTemplateAssets();
  const coverHtml = renderGroupCoverHtml(
    {
      reference: input.reference,
      group_code: input.group_code,
      label: input.label,
      guide_name: input.guide_name,
      travel_start_date: input.travel_start_date,
      travel_end_date: input.travel_end_date,
      generated_at: new Date(),
      travellers: sections.map((s) => {
        const present = new Set(s.sources.map((x) => x.docType));
        return {
          full_name: s.traveller.full_name,
          passport_number: s.traveller.passport_number,
          nationality: s.traveller.nationality,
          docs: REQUIRED_DOC_TYPES.filter((r) => present.has(r)).length,
          docs_total: REQUIRED_DOC_TYPES.length,
          pages: s.built.pageCount,
        };
      }),
    },
    assets,
  );
  const coverPdf = await PDFDocument.load(await renderPdfWithBrowser(browser, coverHtml));

  const merged = await PDFDocument.create();
  for (const page of await merged.copyPages(coverPdf, coverPdf.getPageIndices())) merged.addPage(page);
  for (const s of sections) {
    const doc = await PDFDocument.load(s.built.bytes);
    for (const page of await merged.copyPages(doc, doc.getPageIndices())) merged.addPage(page);
  }

  merged.setTitle(`${input.reference} - Group Travel Pack`);
  merged.setAuthor("Mandarin Roots");
  merged.setSubject(`Group ${input.group_code} travel documents`);
  merged.setCreator("Mandarin Roots operations platform");
  merged.setProducer("pdf-lib");
  merged.setCreationDate(new Date());
  merged.setModificationDate(new Date());

  return {
    bytes: await merged.save(),
    pageCount: merged.getPageCount(),
    includedDocIds: sections.flatMap((s) => s.built.includedDocIds),
    warnings,
  };
}

export type PackResult = {
  packId: string;
  storagePath: string;
  pageCount: number;
  fileName: string;
  warnings: string[];
};

/**
 * Compile the travel pack for one traveller: fetch documents in merge order,
 * build the PDF, upload it to the private travel-packs bucket and record a
 * travel_packs row (history is never overwritten).
 */
export async function compileTravelPack(
  supabase: SupabaseClient<Database>,
  browser: Browser,
  travellerId: string,
  generatedBy: string,
): Promise<PackResult> {
  const { data: t, error } = await supabase
    .from("travellers")
    .select("id, traveller_ref, full_name, passport_number, nationality, travel_start_date, travel_end_date, visa_reference, group:travel_groups(group_code, label)")
    .eq("id", travellerId)
    .single();
  if (error || !t) throw new Error("Traveller not found");

  const { data: docs } = await supabase
    .from("traveller_documents")
    .select("id, doc_type, file_name, storage_path, mime_type")
    .eq("traveller_id", travellerId)
    .is("deleted_at", null)
    .order("merge_order")
    .order("uploaded_at");

  const sources: PackSource[] = [];
  const warnings: string[] = [];
  for (const d of docs ?? []) {
    const { data: blob, error: dlError } = await supabase.storage.from(BUCKETS.travellerDocuments).download(d.storage_path);
    if (dlError || !blob) {
      warnings.push(`${labelFor(DOC_TYPES, d.doc_type)} (${d.file_name}) skipped: ${dlError?.message ?? "download failed"}`);
      continue;
    }
    sources.push({ docId: d.id, docType: d.doc_type, fileName: d.file_name, mimeType: d.mime_type, bytes: new Uint8Array(await blob.arrayBuffer()) });
  }

  const built = await buildTravelPackPdf(
    browser,
    {
      id: t.id,
      traveller_ref: t.traveller_ref,
      full_name: t.full_name,
      passport_number: t.passport_number,
      nationality: t.nationality,
      travel_start_date: t.travel_start_date,
      travel_end_date: t.travel_end_date,
      visa_reference: t.visa_reference,
      group_code: t.group?.group_code ?? null,
      group_label: t.group?.label ?? null,
    },
    sources,
  );
  warnings.push(...built.warnings);

  const stamp = formatInTimeZone(new Date(), TIMEZONE, "yyyyMMdd-HHmmss");
  const fileName = `${t.traveller_ref}-travel-pack-${stamp}.pdf`;
  const storagePath = `${t.id}/${fileName}`;

  const { error: upError } = await supabase.storage
    .from(BUCKETS.travelPacks)
    .upload(storagePath, Buffer.from(built.bytes), { contentType: "application/pdf", upsert: false });
  if (upError) throw new Error(`Upload failed: ${upError.message}`);

  const { data: row, error: rowError } = await supabase
    .from("travel_packs")
    .insert({
      traveller_id: t.id,
      storage_path: storagePath,
      page_count: built.pageCount,
      included_doc_ids: built.includedDocIds,
      generated_by: generatedBy,
    })
    .select("id")
    .single();
  if (rowError || !row) throw new Error(`Could not record travel pack: ${rowError?.message}`);

  return { packId: row.id, storagePath, pageCount: built.pageCount, fileName, warnings };
}
