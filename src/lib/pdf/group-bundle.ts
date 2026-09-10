import type { SupabaseClient } from "@supabase/supabase-js";
import type { Browser } from "puppeteer-core";
import type { Database } from "@/types/database";
import { buildGroupPackPdf, type BuiltPack, type PackSource } from "@/lib/pdf/travel-pack";
import { groupPackReference } from "@/lib/queries/travel";
import { BUCKETS, DOC_TYPES, PACKAGE_TIERS, labelFor } from "@/lib/constants";
import { formatDate } from "@/lib/format";

type Client = SupabaseClient<Database>;

export type BundleLogo = "mr" | "partner" | "none";

export type GroupBundle = BuiltPack & {
  groupId: string;
  reference: string;
  fileName: string;
  travellerCount: number;
  source: string;
};

async function download(supabase: Client, bucket: string, path: string): Promise<Uint8Array | null> {
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) return null;
  return new Uint8Array(await data.arrayBuffer());
}

function mimeFromName(name: string | null | undefined): string {
  return /\.jpe?g$/i.test(name ?? "") ? "image/jpeg" : "image/png";
}

/**
 * One PDF for a group: cover, then the visa page (when received), then the
 * documents. For our own groups the documents are every traveller's uploads
 * in order; for a B2B group they are the partner's compiled pack.
 *
 * `logo` decides the cover branding. "partner" uses the partner's logo when
 * one is on file and falls back to their code as plain text; "none" prints
 * only the partner code; "mr" is the Mandarin Roots logo.
 */
export async function buildGroupBundle(supabase: Client, browser: Browser, groupId: string, opts: { logo?: BundleLogo; includeVisa?: boolean } = {}): Promise<GroupBundle> {
  const { data: group } = await supabase
    .from("travel_groups")
    .select(
      "id, travel_date, travel_end_date, group_code, label, guide_name, reference_prefix, entry_port, exit_port, source, partner_code, pax_expected, pack_path, package_tier, hotel_name, visa_status, visa_applied_at, visa_path, travellers(id, traveller_ref, full_name, passport_number, nationality, travel_start_date, travel_end_date, visa_reference, status, traveller_documents(id, doc_type, file_name, storage_path, mime_type, merge_order, uploaded_at, deleted_at))",
    )
    .eq("id", groupId)
    .maybeSingle();
  if (!group) throw new Error("Group not found");

  const isB2b = group.source === "b2b";
  const travellers = [...group.travellers].filter((t) => t.status !== "cancelled").sort((a, b) => a.full_name.localeCompare(b.full_name));
  if (!isB2b && travellers.length === 0) throw new Error("This group has no travellers");

  const warnings: string[] = [];
  const attachments: { label: string; bytes: Uint8Array }[] = [];

  if (opts.includeVisa !== false && group.visa_path) {
    const bytes = await download(supabase, BUCKETS.travelPacks, group.visa_path);
    if (bytes) attachments.push({ label: "Group visa", bytes });
    else warnings.push("Visa page could not be read from storage");
  }

  if (isB2b) {
    if (!group.pack_path) throw new Error("No partner pack has been uploaded for this group");
    const bytes = await download(supabase, BUCKETS.travelPacks, group.pack_path);
    if (!bytes) throw new Error("Partner pack could not be read from storage");
    attachments.push({ label: `${group.partner_code} pack (${group.pax_expected ?? 0} pax)`, bytes });
  }

  const inputs: { traveller: (typeof travellers)[number] & { group_code: string; group_label: string | null }; sources: PackSource[] }[] = [];
  if (!isB2b) {
    for (const t of travellers) {
      const docs = t.traveller_documents
        .filter((d) => !d.deleted_at)
        .sort((a, b) => a.merge_order - b.merge_order || (a.uploaded_at ?? "").localeCompare(b.uploaded_at ?? ""));
      const sources: PackSource[] = [];
      for (const d of docs) {
        const bytes = await download(supabase, BUCKETS.travellerDocuments, d.storage_path);
        if (!bytes) {
          warnings.push(`${t.full_name}: ${labelFor(DOC_TYPES, d.doc_type)} (${d.file_name}) skipped: download failed`);
          continue;
        }
        sources.push({ docId: d.id, docType: d.doc_type, fileName: d.file_name, mimeType: d.mime_type, bytes });
      }
      inputs.push({ traveller: { ...t, group_code: group.group_code, group_label: group.label }, sources });
    }
  }

  // Cover branding
  const logoChoice: BundleLogo = opts.logo ?? (isB2b ? "partner" : "mr");
  let logoSrc: string | null | undefined = undefined;
  let brandName: string | null = null;
  if (isB2b && logoChoice !== "mr") {
    const { data: partner } = await supabase.from("b2b_partners").select("name, logo_path, logo_file_name").eq("code", group.partner_code ?? "").maybeSingle();
    brandName = partner?.name || group.partner_code || null;
    logoSrc = null;
    if (logoChoice === "partner" && partner?.logo_path) {
      const bytes = await download(supabase, BUCKETS.partnerLogos, partner.logo_path);
      if (bytes) logoSrc = `data:${mimeFromName(partner.logo_file_name)};base64,${Buffer.from(bytes).toString("base64")}`;
      else warnings.push("Partner logo could not be read; cover shows the partner name instead");
    }
  }

  const pax = isB2b ? (group.pax_expected ?? travellers.length) : travellers.length;
  const reference = groupPackReference(group, pax);
  const visaLabel =
    group.visa_status === "approved" ? `Received${group.visa_path ? ", attached" : ""}` : group.visa_status === "applied" ? `Applied${group.visa_applied_at ? ` on ${formatDate(group.visa_applied_at)}` : ""}` : "Not yet applied";

  const built = await buildGroupPackPdf(browser, {
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
    partner_code: isB2b ? group.partner_code : null,
    pax_expected: isB2b ? group.pax_expected : null,
    package_label: group.package_tier ? labelFor(PACKAGE_TIERS, group.package_tier) : null,
    hotel_name: group.hotel_name,
    visa_label: visaLabel,
    attachments,
  });

  return {
    ...built,
    warnings: [...warnings, ...built.warnings],
    groupId: group.id,
    reference,
    fileName: `${reference}${group.visa_path && opts.includeVisa !== false ? "-WITH-VISA" : ""}.pdf`,
    travellerCount: travellers.length,
    source: group.source,
  };
}
