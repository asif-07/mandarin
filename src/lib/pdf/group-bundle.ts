import { createHash } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Browser } from "puppeteer-core";
import type { Database } from "@/types/database";
import { buildGroupPackPdf, type BuiltPack, type PackSource } from "@/lib/pdf/travel-pack";
import { groupPackReference } from "@/lib/queries/travel";
import { BUCKETS, DOC_TYPES, GROUP_DOC_TYPES, PACKAGE_TIERS, labelFor } from "@/lib/constants";
import { formatDate } from "@/lib/format";

type Client = SupabaseClient<Database>;

export type BundleLogo = "mr" | "partner" | "none";

export type GroupBundle = BuiltPack & {
  groupId: string;
  reference: string;
  fileName: string;
  travellerCount: number;
  source: string;
  cachePath: string;
};

const GROUP_SELECT =
  "id, travel_date, travel_end_date, group_code, label, guide_name, reference_prefix, entry_port, exit_port, source, partner_code, pax_expected, pack_path, pack_uploaded_at, package_tier, hotel_name, hotel_stars, transit_location, visa_status, visa_applied_at, visa_path, visa_uploaded_at, group_documents(id, doc_type, file_name, storage_path, mime_type, uploaded_at, deleted_at), travellers(id, traveller_ref, full_name, passport_number, nationality, travel_start_date, travel_end_date, visa_reference, status, updated_at, traveller_documents(id, doc_type, file_name, storage_path, mime_type, merge_order, uploaded_at, deleted_at))";

async function download(supabase: Client, bucket: string, path: string): Promise<Uint8Array | null> {
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) return null;
  return new Uint8Array(await data.arrayBuffer());
}

/** Run async jobs with bounded concurrency, keeping result order. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]!);
      }
    }),
  );
  return out;
}

function mimeFromName(name: string | null | undefined): string {
  return /\.jpe?g$/i.test(name ?? "") ? "image/jpeg" : "image/png";
}

type GroupRow = NonNullable<Awaited<ReturnType<typeof loadGroup>>>;

/**
 * Cover branding by stage. Until the visa is received every download is for
 * the visa application and carries the Mandarin Roots cover (entry, exit,
 * pax, dates). Once the visa is uploaded, a partner group's download goes to
 * the partner under their own logo (name only when no logo is on file); our
 * own groups keep the Mandarin Roots cover for the client.
 */
export function defaultBundleLogo(group: { source: string; partner_code: string | null; visa_status: string; visa_path: string | null }): BundleLogo {
  return !!group.partner_code && group.visa_status === "approved" && !!group.visa_path ? "partner" : "mr";
}

async function loadGroup(supabase: Client, groupId: string) {
  const { data } = await supabase.from("travel_groups").select(GROUP_SELECT).eq("id", groupId).maybeSingle();
  return data;
}

/**
 * Everything that changes the bundle's content goes into the cache key, so a
 * second download of an unchanged group is served from storage instantly.
 */
export type BundleScope = "all" | "visa";

/** True when a PDF was produced by this app's pack compiler (its Creator is set in travel-pack.ts). */
function isAppCompiledPack(doc: PDFDocument): boolean {
  try {
    return (doc.getCreator() ?? "").startsWith("Mandarin Roots operations platform");
  } catch {
    return false;
  }
}

/**
 * Put the freshly built front pages (cover, visa, group documents) in front
 * of the partner's own pack without copying the pack's pages. A pack that was
 * compiled by this app (our own group pack, downloaded and then uploaded as
 * the partner's file) already starts with a Mandarin Roots cover, so that
 * first page is dropped: the download carries one cover, not two.
 */
export async function insertFrontPages(partnerPackBytes: Uint8Array, frontBytes: Uint8Array, meta: { title: string; author: string }): Promise<{ bytes: Uint8Array; pageCount: number; droppedOwnCover: boolean }> {
  // updateMetadata: false keeps the file's own Creator so an app-compiled pack can be recognised.
  const base = await PDFDocument.load(partnerPackBytes, { ignoreEncryption: true, updateMetadata: false });
  const droppedOwnCover = isAppCompiledPack(base) && base.getPageCount() > 1;
  if (droppedOwnCover) base.removePage(0);
  const frontDoc = await PDFDocument.load(frontBytes);
  const pages = await base.copyPages(frontDoc, frontDoc.getPageIndices());
  pages.forEach((p, i) => base.insertPage(i, p));
  base.setTitle(meta.title);
  base.setAuthor(meta.author);
  base.setModificationDate(new Date());
  return { bytes: await base.save({ useObjectStreams: false }), pageCount: base.getPageCount(), droppedOwnCover };
}

function cacheKey(group: GroupRow, logo: BundleLogo, partnerLogoPath: string | null, scope: BundleScope = "all"): string {
  const docs = group.travellers
    .flatMap((t) => t.traveller_documents.filter((d) => !d.deleted_at).map((d) => `${t.id}:${d.id}:${d.uploaded_at}`))
    .sort();
  const groupDocs = group.group_documents.filter((d) => !d.deleted_at).map((d) => `${d.id}:${d.uploaded_at}`).sort();
  const travellers = group.travellers
    .filter((t) => t.status !== "cancelled")
    .map((t) => `${t.id}:${t.updated_at}`)
    .sort();
  const h = createHash("sha1");
  // travel_groups has no updated_at, so the cover's own fields are hashed directly.
  const cover = [group.group_code, group.label, group.guide_name, group.reference_prefix, group.entry_port, group.exit_port, group.travel_date, group.travel_end_date, group.partner_code, group.pax_expected, group.package_tier, group.hotel_name, group.hotel_stars, group.transit_location, group.visa_applied_at];
  h.update(JSON.stringify({ v: 4, logo, scope, partnerLogoPath, cover, pack: group.pack_uploaded_at, visa: group.visa_uploaded_at, visa_status: group.visa_status, docs, groupDocs, travellers }));
  return h.digest("hex").slice(0, 20);
}

export type CachedBundle = { path: string; fileName: string };

/** Returns the storage path of an already-built bundle for this exact state, or null. */
export async function findCachedBundle(supabase: Client, groupId: string, opts: { logo?: BundleLogo; scope?: BundleScope } = {}): Promise<CachedBundle | null> {
  const group = await loadGroup(supabase, groupId);
  if (!group) return null;
  const isB2b = group.source === "b2b";
  const logo: BundleLogo = opts.logo ?? defaultBundleLogo(group);
  let partnerLogoPath: string | null = null;
  if (group.partner_code && logo === "partner") {
    const { data: partner } = await supabase.from("b2b_partners").select("logo_path").eq("code", group.partner_code ?? "").maybeSingle();
    partnerLogoPath = partner?.logo_path ?? null;
  }
  const key = cacheKey(group, logo, partnerLogoPath, opts.scope ?? "all");
  const { data: files } = await supabase.storage.from(BUCKETS.travelPacks).list(`_bundles/${group.id}/${key}`, { limit: 1 });
  const file = files?.[0];
  if (!file) return null;
  return { path: `_bundles/${group.id}/${key}/${file.name}`, fileName: file.name };
}

/**
 * One PDF for a group: cover, then the visa page (when received), then the
 * group-level flight ticket / hotel booking, then the documents. For our own
 * groups the documents are every traveller's uploads in order; for a B2B
 * group they are the partner's compiled pack.
 *
 * `logo` decides the cover branding. "partner" uses the partner's logo when
 * one is on file and falls back to their name as plain text; "none" prints
 * only the partner name; "mr" is the Mandarin Roots logo.
 */
/**
 * `scope` "visa" builds only the cover and the visa page (what a client or
 * partner needs once the visa is issued); "all" adds every document / the
 * partner pack as before.
 */
export async function buildGroupBundle(supabase: Client, browser: Browser, groupId: string, opts: { logo?: BundleLogo; includeVisa?: boolean; scope?: BundleScope } = {}): Promise<GroupBundle> {
  const scope: BundleScope = opts.scope === "visa" && !!groupId ? "visa" : "all";
  const visaOnly = scope === "visa";
  const group = await loadGroup(supabase, groupId);
  if (!group) throw new Error("Group not found");

  const isB2b = group.source === "b2b";
  const travellers = [...group.travellers].filter((t) => t.status !== "cancelled").sort((a, b) => a.full_name.localeCompare(b.full_name));
  if (visaOnly && !group.visa_path) throw new Error("No visa has been uploaded for this group yet");
  if (!isB2b && !visaOnly && travellers.length === 0) throw new Error("This group has no travellers");

  const warnings: string[] = [];
  const attachments: { label: string; bytes: Uint8Array; mimeType?: string }[] = [];

  // Cover branding (fetched in parallel with the files below)
  const logoChoice: BundleLogo = opts.logo ?? defaultBundleLogo(group);
  const partnerPromise = group.partner_code && logoChoice !== "mr" ? supabase.from("b2b_partners").select("name, logo_path, logo_file_name").eq("code", group.partner_code ?? "").maybeSingle() : null;

  // Visa, group documents and the partner pack, downloaded together
  const groupDocs = group.group_documents.filter((d) => !d.deleted_at).sort((a, b) => GROUP_DOC_TYPES.findIndex((t) => t.value === a.doc_type) - GROUP_DOC_TYPES.findIndex((t) => t.value === b.doc_type));
  const [visaBytes, groupDocBytes, packBytes, partnerRes] = await Promise.all([
    opts.includeVisa !== false && group.visa_path ? download(supabase, BUCKETS.travelPacks, group.visa_path) : Promise.resolve(null),
    visaOnly ? Promise.resolve([] as (Uint8Array | null)[]) : mapLimit(groupDocs, 4, (d) => download(supabase, BUCKETS.travellerDocuments, d.storage_path)),
    isB2b && group.pack_path && !visaOnly ? download(supabase, BUCKETS.travelPacks, group.pack_path) : Promise.resolve(null),
    partnerPromise,
  ]);

  if (opts.includeVisa !== false && group.visa_path) {
    if (visaBytes) attachments.push({ label: "Group visa", bytes: visaBytes });
    else warnings.push("Visa page could not be read from storage");
  }
  (visaOnly ? [] : groupDocs).forEach((d, i) => {
    const bytes = groupDocBytes[i];
    const label = GROUP_DOC_TYPES.find((t) => t.value === d.doc_type)?.label ?? d.doc_type;
    if (bytes) attachments.push({ label: `${label} (${d.file_name})`, bytes, mimeType: d.mime_type });
    else warnings.push(`${label} (${d.file_name}) could not be read from storage`);
  });

  let partnerPackBytes: Uint8Array | null = null;
  if (isB2b && !visaOnly) {
    if (!group.pack_path) throw new Error("No partner pack has been uploaded for this group");
    if (!packBytes) throw new Error("Partner pack could not be read from storage");
    partnerPackBytes = packBytes;
  }

  // Every traveller's documents, downloaded with bounded concurrency
  const inputs: { traveller: (typeof travellers)[number] & { group_code: string; group_label: string | null }; sources: PackSource[] }[] = [];
  if (!isB2b && !visaOnly) {
    const jobs = travellers.flatMap((t) =>
      t.traveller_documents
        .filter((d) => !d.deleted_at)
        .sort((a, b) => a.merge_order - b.merge_order || (a.uploaded_at ?? "").localeCompare(b.uploaded_at ?? ""))
        .map((d) => ({ t, d })),
    );
    const bytesList = await mapLimit(jobs, 6, ({ d }) => download(supabase, BUCKETS.travellerDocuments, d.storage_path));
    const byTraveller = new Map<string, PackSource[]>();
    jobs.forEach(({ t, d }, i) => {
      const bytes = bytesList[i];
      if (!bytes) {
        warnings.push(`${t.full_name}: ${labelFor(DOC_TYPES, d.doc_type)} (${d.file_name}) skipped: download failed`);
        return;
      }
      const list = byTraveller.get(t.id) ?? [];
      list.push({ docId: d.id, docType: d.doc_type, fileName: d.file_name, mimeType: d.mime_type, bytes });
      byTraveller.set(t.id, list);
    });
    for (const t of travellers) inputs.push({ traveller: { ...t, group_code: group.group_code, group_label: group.label }, sources: byTraveller.get(t.id) ?? [] });
  }

  let logoSrc: string | null | undefined = undefined;
  let brandName: string | null = null;
  let partnerLogoPath: string | null = null;
  if (group.partner_code && logoChoice !== "mr") {
    const partner = partnerRes?.data ?? null;
    brandName = partner?.name || group.partner_code || null;
    logoSrc = null;
    if (logoChoice === "partner" && partner?.logo_path) {
      partnerLogoPath = partner.logo_path;
      const bytes = await download(supabase, BUCKETS.partnerLogos, partner.logo_path);
      if (bytes) logoSrc = `data:${mimeFromName(partner.logo_file_name)};base64,${Buffer.from(bytes).toString("base64")}`;
      else warnings.push("Partner logo could not be read; cover shows the partner name instead");
    }
  }

  const pax = isB2b ? (group.pax_expected ?? travellers.length) : travellers.length;
  const reference = groupPackReference(group, pax);
  const visaLabel =
    group.visa_status === "approved" ? `Received${group.visa_path ? ", attached" : ""}` : group.visa_status === "applied" ? `Applied${group.visa_applied_at ? ` on ${formatDate(group.visa_applied_at)}` : ""}` : "Not yet applied";

  // For B2B groups the partner pack can be very large. Rather than copying all
  // of its pages into a new document, the cover (and visa / group docs) are
  // built on their own and inserted at the front of the pack itself.
  const front = await buildGroupPackPdf(browser, {
    reference,
    group_code: group.group_code,
    label: group.label,
    guide_name: group.guide_name,
    entry_port: group.entry_port,
    exit_port: group.exit_port,
    travel_start_date: group.travel_date,
    travel_end_date: group.travel_end_date,
    travellers: inputs,
    logoSrc,
    brand_name: brandName,
    partner_code: group.partner_code,
    pax_expected: isB2b ? group.pax_expected : null,
    package_label: group.package_tier ? labelFor(PACKAGE_TIERS, group.package_tier) : null,
    hotel_name: [group.hotel_stars ? `${group.hotel_stars}-star` : null, group.hotel_name, group.transit_location ? `Transit via ${group.transit_location}` : null].filter(Boolean).join(" · ") || null,
    visa_label: visaLabel,
    attachments: isB2b && partnerPackBytes ? [...attachments, { label: `${group.partner_code} pack (${group.pax_expected ?? 0} pax)`, bytes: partnerPackBytes, mimeType: "application/pdf", coverOnly: true }] : attachments,
  });

  let bytes = front.bytes;
  let pageCount = front.pageCount;
  if (isB2b && partnerPackBytes) {
    const merged = await insertFrontPages(partnerPackBytes, front.bytes, { title: `${reference} - Group Travel Pack`, author: brandName && logoChoice !== "mr" ? brandName : "Mandarin Roots" });
    bytes = merged.bytes;
    pageCount = merged.pageCount;
    if (merged.droppedOwnCover) warnings.push("The uploaded partner pack was compiled by this app, so its own cover page was left out");
  }

  const fileName = `${reference}${visaOnly ? "-VISA" : group.visa_path && opts.includeVisa !== false ? "-WITH-VISA" : ""}.pdf`;
  return {
    bytes,
    pageCount,
    includedDocIds: front.includedDocIds,
    warnings: [...warnings, ...front.warnings],
    groupId: group.id,
    reference,
    fileName,
    travellerCount: travellers.length,
    source: group.source,
    cachePath: `_bundles/${group.id}/${cacheKey(group, logoChoice, partnerLogoPath, scope)}/${fileName}`,
  };
}
