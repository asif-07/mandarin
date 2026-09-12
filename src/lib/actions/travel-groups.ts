"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { bulkGroupSchema, groupSchema, hotelFields, hotelStars, type BulkGroupInput, type GroupInput } from "@/lib/validation/travel";
import { errorMessage, fail, ok, type ActionResult } from "@/lib/result";
import { formatDate, todayISO } from "@/lib/format";
import { BUCKETS, PACKAGE_TIERS } from "@/lib/constants";
import { markGroupVisaApproved } from "@/lib/travel/visa";
import { b2bReference, parseB2bCode } from "@/lib/travel/b2b-code";
import { groupPackReference } from "@/lib/queries/travel";
import { PDFDocument } from "pdf-lib";
import { imageToPdfPage } from "@/lib/pdf/travel-pack";

function revalidateTravel() {
  revalidatePath("/travel");
  revalidatePath("/travel/groups");
  revalidatePath("/travel/calendar");
  revalidatePath("/travel/travellers");
  revalidatePath("/");
}

/** "2026-10" -> whole month, "2026-10-15" -> that day; anything else -> null. */
export async function dateRangeForQuery(q: string): Promise<[string, string] | null> {
  return dateRange(q);
}

function dateRange(q: string): [string, string] | null {
  const day = q.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (day) return [q, q];
  const month = q.match(/^(\d{4})-(\d{2})$/);
  if (month) {
    const last = new Date(Date.UTC(Number(month[1]), Number(month[2]), 0)).getUTCDate();
    return [`${q}-01`, `${q}-${String(last).padStart(2, "0")}`];
  }
  return null;
}

export type GroupOption = {
  id: string;
  travel_date: string;
  travel_end_date: string;
  group_code: string;
  label: string | null;
  guide_name: string | null;
  reference_prefix: string;
  entry_port?: string | null;
  exit_port?: string | null;
  source?: string | null;
  partner_code?: string | null;
  pax_expected?: number | null;
  traveller_count: number;
};

export async function createGroup(input: GroupInput): Promise<ActionResult<{ id: string }>> {
  const profile = await requireProfile();
  const parsed = groupSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields", z.flattenError(parsed.error).fieldErrors);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("travel_groups")
    .insert({ ...parsed.data, created_by: profile.id })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return fail(`${parsed.data.group_code} already exists on ${formatDate(parsed.data.travel_date)}`);
    return fail(errorMessage(error, "Could not create group"));
  }
  revalidateTravel();
  return ok({ id: data.id });
}

/** Creates G01..Gn for a date, skipping codes that already exist. */
export async function bulkCreateGroups(input: BulkGroupInput): Promise<ActionResult<{ created: number; skipped: number }>> {
  const profile = await requireProfile();
  const parsed = bulkGroupSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields", z.flattenError(parsed.error).fieldErrors);
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("travel_groups")
    .select("group_code")
    .eq("travel_date", parsed.data.travel_date);
  const have = new Set((existing ?? []).map((g) => g.group_code));

  const rows = Array.from({ length: parsed.data.count }, (_, i) => `G${String(i + 1).padStart(2, "0")}`)
    .filter((code) => !have.has(code))
    .map((code) => ({
      travel_date: parsed.data.travel_date,
      travel_end_date: parsed.data.travel_end_date,
      group_code: code,
      reference_prefix: parsed.data.reference_prefix,
      entry_port: parsed.data.entry_port,
      exit_port: parsed.data.exit_port,
      package_tier: parsed.data.package_tier,
      hotel_name: parsed.data.hotel_name,
      hotel_stars: parsed.data.hotel_stars,
      label: parsed.data.label,
      guide_name: parsed.data.guide_name,
      created_by: profile.id,
    }));

  if (rows.length > 0) {
    const { error } = await supabase.from("travel_groups").insert(rows);
    if (error) return fail(errorMessage(error, "Could not create groups"));
  }
  revalidateTravel();
  return ok({ created: rows.length, skipped: parsed.data.count - rows.length });
}

export async function updateGroup(id: string, input: GroupInput): Promise<ActionResult<{ id: string }>> {
  await requireProfile();
  const parsed = groupSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields", z.flattenError(parsed.error).fieldErrors);
  const supabase = await createClient();
  const { error } = await supabase.from("travel_groups").update(parsed.data).eq("id", id);
  if (error) {
    if (error.code === "23505") return fail(`${parsed.data.group_code} already exists on ${formatDate(parsed.data.travel_date)}`);
    return fail(errorMessage(error, "Could not update group"));
  }
  revalidateTravel();
  return ok({ id });
}

/**
 * Delete a group. Travellers in it are never deleted: with `unassign` they are
 * kept and detached from the group; without it a non-empty group is refused.
 */
export async function deleteGroup(id: string, unassign = false): Promise<ActionResult<{ id: string; unassigned: number }>> {
  await requireProfile();
  const supabase = await createClient();
  const { count } = await supabase.from("travellers").select("id", { count: "exact", head: true }).eq("travel_group_id", id);
  const travellers = count ?? 0;
  if (travellers > 0 && !unassign) {
    return fail(`This group has ${travellers} traveller${travellers === 1 ? "" : "s"}. Confirm to remove them from the group and delete it.`);
  }
  if (travellers > 0) {
    const { error: unassignError } = await supabase.from("travellers").update({ travel_group_id: null }).eq("travel_group_id", id);
    if (unassignError) return fail(errorMessage(unassignError, "Could not remove travellers from the group"));
  }
  const { error } = await supabase.from("travel_groups").delete().eq("id", id);
  if (error) return fail(errorMessage(error, "Could not delete group"));
  revalidateTravel();
  return ok({ id, unassigned: travellers });
}

/** Searchable group list for dropdowns, newest travel dates first. */
export async function searchGroups(query: string, limit = 60): Promise<GroupOption[]> {
  await requireProfile();
  const supabase = await createClient();
  const q = query.trim();
  let req = supabase
    .from("travel_groups")
    .select("id, travel_date, travel_end_date, group_code, label, guide_name, reference_prefix, entry_port, exit_port, source, partner_code, pax_expected, travellers(count)")
    .order("travel_date", { ascending: false })
    .order("group_code", { ascending: true })
    .limit(limit);
  if (q) {
    const range = dateRange(q);
    if (range) req = req.gte("travel_date", range[0]).lte("travel_date", range[1]);
    else {
      const like = `%${q.replace(/[%,]/g, "")}%`;
      req = req.or(`group_code.ilike.${like},label.ilike.${like},guide_name.ilike.${like}`);
    }
  }
  const { data } = await req;
  return (data ?? []).map((g) => ({
    id: g.id,
    travel_date: g.travel_date,
    travel_end_date: g.travel_end_date,
    group_code: g.group_code,
    label: g.label,
    guide_name: g.guide_name,
    reference_prefix: g.reference_prefix,
    entry_port: g.entry_port,
    exit_port: g.exit_port,
    source: g.source,
    partner_code: g.partner_code,
    pax_expected: g.pax_expected,
    traveller_count: Array.isArray(g.travellers) ? Number(g.travellers[0]?.count ?? 0) : 0,
  }));
}

// ---------------------------------------------------------------------------
// B2B partner groups
// ---------------------------------------------------------------------------
export type B2bPreview = {
  partner_code: string;
  travel_date: string;
  travel_end_date: string;
  pax: number;
  partner_group: string;
  partner_reference: string;
  our_group_code: string;
  our_reference: string;
  existing_codes: string[];
  duplicate: { id: string; group_code: string } | null;
};

/** Parse a partner code and work out which G-code it will get on that date. */
export async function previewB2bCode(code: string): Promise<ActionResult<B2bPreview>> {
  await requireProfile();
  const parsed = parseB2bCode(code, todayISO());
  if (!parsed.ok) return fail(parsed.error);
  const v = parsed.value;
  const supabase = await createClient();
  const [{ data: existing }, { data: next }] = await Promise.all([
    supabase.from("travel_groups").select("id, group_code, partner_reference").eq("travel_date", v.travel_date).order("group_code"),
    supabase.rpc("next_group_code", { p_date: v.travel_date }),
  ]);
  const ourCode = typeof next === "string" ? next : "G01";
  const dup = (existing ?? []).find((g) => g.partner_reference && g.partner_reference.toUpperCase() === v.normalised) ?? null;
  return ok({
    partner_code: v.partner_code,
    travel_date: v.travel_date,
    travel_end_date: v.travel_end_date,
    pax: v.pax,
    partner_group: v.partner_group,
    partner_reference: v.normalised,
    our_group_code: ourCode,
    our_reference: b2bReference({ reference_prefix: v.prefix, partner_code: v.partner_code, travel_date: v.travel_date, travel_end_date: v.travel_end_date, group_code: ourCode }, v.pax),
    existing_codes: (existing ?? []).map((g) => g.group_code),
    duplicate: dup ? { id: dup.id, group_code: dup.group_code } : null,
  });
}

const b2bRegisterSchema = z.object({
  code: z.string().trim().min(1, "Enter the partner's code"),
  upload_path: z.string().min(1).max(500),
  file_name: z.string().trim().min(1).max(255),
  entry_port: z.string().trim().max(120).optional().nullable().transform((v) => (v ? v : null)),
  exit_port: z.string().trim().max(120).optional().nullable().transform((v) => (v ? v : null)),
  label: z.string().trim().max(200).optional().nullable().transform((v) => (v ? v : null)),
  guide_name: z.string().trim().max(200).optional().nullable().transform((v) => (v ? v : null)),
  notes: z.string().trim().max(2000).optional().nullable().transform((v) => (v ? v : null)),
  package_tier: z
    .enum(PACKAGE_TIERS.map((t) => t.value) as [string, ...string[]])
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  hotel_name: z.string().trim().max(200).optional().nullable().transform((v) => (v ? v : null)),
  hotel_stars: hotelStars,
});
export type B2bRegisterInput = z.input<typeof b2bRegisterSchema>;

/**
 * Create the group for an uploaded partner pack. The file was uploaded by the
 * browser to a temporary path; it is moved under the new group and renamed
 * to our reference (partner code, dates, pax and OUR group number).
 */
export async function registerB2bGroup(input: B2bRegisterInput): Promise<ActionResult<{ id: string; group_code: string; reference: string; travel_date: string }>> {
  const profile = await requireProfile();
  const parsed = b2bRegisterSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields", z.flattenError(parsed.error).fieldErrors);
  const code = parseB2bCode(parsed.data.code, todayISO());
  if (!code.ok) return fail(code.error, { code: [code.error] });
  if (!parsed.data.upload_path.startsWith("_b2b/incoming/")) return fail("Upload the PDF first");
  const v = code.value;
  const supabase = await createClient();

  const { data: created, error } = await supabase.rpc("create_b2b_group", {
    p: {
      travel_date: v.travel_date,
      travel_end_date: v.travel_end_date,
      reference_prefix: v.prefix,
      partner_code: v.partner_code,
      partner_reference: v.normalised,
      pax_expected: v.pax,
      label: parsed.data.label ?? `${v.partner_code} · ${v.pax} pax`,
      guide_name: parsed.data.guide_name,
      notes: parsed.data.notes,
      entry_port: parsed.data.entry_port,
      exit_port: parsed.data.exit_port,
      package_tier: parsed.data.package_tier,
      ...hotelFields(parsed.data),
    },
  });
  // Remember the partner so a logo can be attached to it later.
  await supabase.from("b2b_partners").upsert({ code: v.partner_code, created_by: profile.id }, { onConflict: "code", ignoreDuplicates: true });
  const row = created as { id?: string; group_code?: string } | null;
  if (error || !row?.id || !row.group_code) return fail(errorMessage(error, "Could not create the group"));

  const reference = b2bReference({ reference_prefix: v.prefix, partner_code: v.partner_code, travel_date: v.travel_date, travel_end_date: v.travel_end_date, group_code: row.group_code }, v.pax);
  const finalPath = `_b2b/${row.id}/${reference}.pdf`;
  const { error: moveError } = await supabase.storage.from(BUCKETS.travelPacks).move(parsed.data.upload_path, finalPath);
  if (moveError) return fail(`Group ${row.group_code} was created but the file could not be filed: ${moveError.message}`);

  const { error: updateError } = await supabase
    .from("travel_groups")
    .update({ pack_path: finalPath, pack_file_name: `${reference}.pdf`, pack_uploaded_at: new Date().toISOString(), pack_uploaded_by: profile.id })
    .eq("id", row.id);
  if (updateError) return fail(errorMessage(updateError, "Could not record the pack"));

  revalidateTravel();
  revalidatePath("/travel/b2b");
  return ok({ id: row.id, group_code: row.group_code, reference, travel_date: v.travel_date });
}

/** Replace the partner pack on an existing B2B group (file already uploaded to the incoming path). */
export async function replaceB2bPack(groupId: string, uploadPath: string): Promise<ActionResult<{ reference: string }>> {
  const profile = await requireProfile();
  if (!uploadPath.startsWith("_b2b/incoming/")) return fail("Upload the PDF first");
  const supabase = await createClient();
  const { data: g } = await supabase
    .from("travel_groups")
    .select("id, travel_date, travel_end_date, group_code, reference_prefix, partner_code, pax_expected, pack_path")
    .eq("id", groupId)
    .maybeSingle();
  if (!g || !g.partner_code) return fail("B2B group not found");
  const reference = b2bReference({ reference_prefix: g.reference_prefix, partner_code: g.partner_code, travel_date: g.travel_date, travel_end_date: g.travel_end_date, group_code: g.group_code }, g.pax_expected ?? 0);
  const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const finalPath = `_b2b/${g.id}/${stamp}/${reference}.pdf`;
  const { error: moveError } = await supabase.storage.from(BUCKETS.travelPacks).move(uploadPath, finalPath);
  if (moveError) return fail(errorMessage(moveError, "Could not file the new pack"));
  const { error } = await supabase
    .from("travel_groups")
    .update({ pack_path: finalPath, pack_file_name: `${reference}.pdf`, pack_uploaded_at: new Date().toISOString(), pack_uploaded_by: profile.id })
    .eq("id", groupId);
  if (error) return fail(errorMessage(error, "Could not record the pack"));
  revalidateTravel();
  revalidatePath("/travel/b2b");
  return ok({ reference });
}

// ---------------------------------------------------------------------------
// group visa page
// ---------------------------------------------------------------------------
/** File the received visa page under the group; the group becomes "visa received" and its travellers visa_approved. */
/**
 * File the received visa page under the group. PDFs are moved into place as
 * they are; a photo (JPG / PNG / HEIC, uploaded to the traveller-documents
 * bucket because travel-packs is PDF-only) is converted to a one-page A4 PDF
 * so the visa can be merged and downloaded like any other.
 */
export async function registerGroupVisa(groupId: string, uploadPath: string, originalName: string, mimeType: string = "application/pdf"): Promise<ActionResult<{ file_name: string }>> {
  const profile = await requireProfile();
  if (!uploadPath.startsWith("_visa/incoming/")) return fail("Upload the visa file first");
  const isImage = mimeType.startsWith("image/");
  const supabase = await createClient();
  const { data: g } = await supabase
    .from("travel_groups")
    .select("id, travel_date, travel_end_date, group_code, reference_prefix, source, partner_code, pax_expected, travellers(count)")
    .eq("id", groupId)
    .maybeSingle();
  if (!g) return fail("Group not found");
  const pax = Array.isArray(g.travellers) ? Number(g.travellers[0]?.count ?? 0) : 0;
  const reference = groupPackReference(g, pax);
  const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const fileName = `${reference}-VISA.pdf`;
  const finalPath = `_visa/${g.id}/${stamp}/${fileName}`;
  if (isImage) {
    try {
      const { data: blob, error: dlError } = await supabase.storage.from(BUCKETS.travellerDocuments).download(uploadPath);
      if (dlError || !blob) throw dlError ?? new Error("Download failed");
      let bytes = new Uint8Array(await blob.arrayBuffer());
      if (mimeType === "image/heic" || mimeType === "image/heif") {
        const convert = (await import("heic-convert")).default;
        bytes = new Uint8Array(await convert({ buffer: bytes, format: "JPEG", quality: 0.9 }));
      }
      const doc = await PDFDocument.create();
      await imageToPdfPage(doc, bytes);
      doc.setTitle(`${reference} - Visa`);
      const pdf = await doc.save();
      const { error: upError } = await supabase.storage.from(BUCKETS.travelPacks).upload(finalPath, Buffer.from(pdf), { contentType: "application/pdf", upsert: false });
      if (upError) throw upError;
      await supabase.storage.from(BUCKETS.travellerDocuments).remove([uploadPath]);
    } catch (e) {
      return fail(`Could not convert the visa photo to PDF: ${errorMessage(e)}`);
    }
  } else {
    const { error: moveError } = await supabase.storage.from(BUCKETS.travelPacks).move(uploadPath, finalPath);
    if (moveError) return fail(errorMessage(moveError, "Could not file the visa"));
  }
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("travel_groups")
    .update({ visa_status: "approved", visa_path: finalPath, visa_file_name: fileName, visa_uploaded_at: now, visa_uploaded_by: profile.id })
    .eq("id", groupId);
  if (error) return fail(errorMessage(error, "Could not record the visa"));
  await supabase.from("travel_groups").update({ visa_applied_at: now }).eq("id", groupId).is("visa_applied_at", null);
  await markGroupVisaApproved(supabase, groupId);
  revalidateTravel();
  revalidatePath("/travel/b2b");
  return ok({ file_name: `${fileName} (from ${originalName})` });
}

/** Undo a visa upload (wrong file): back to "visa applied"; the file stays in storage. */
export async function clearGroupVisa(groupId: string): Promise<ActionResult<{ id: string }>> {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase
    .from("travel_groups")
    .update({ visa_status: "applied", visa_path: null, visa_file_name: null, visa_uploaded_at: null, visa_uploaded_by: null })
    .eq("id", groupId);
  if (error) return fail(errorMessage(error, "Could not clear the visa"));
  revalidateTravel();
  revalidatePath("/travel/b2b");
  return ok({ id: groupId });
}

// ---------------------------------------------------------------------------
// B2B partners (name + logo used on cover pages)
// ---------------------------------------------------------------------------
export type PartnerRow = { id: string; code: string; name: string | null; logo_path: string | null; logo_file_name: string | null };

export async function listPartners(): Promise<PartnerRow[]> {
  await requireProfile();
  const supabase = await createClient();
  const { data } = await supabase.from("b2b_partners").select("id, code, name, logo_path, logo_file_name").order("code");
  return data ?? [];
}

export async function savePartner(input: { code: string; name?: string | null }): Promise<ActionResult<{ id: string }>> {
  const profile = await requireProfile();
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z0-9]{2,12}$/.test(code)) return fail("Partner code: 2–12 letters or digits, e.g. EDPT");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("b2b_partners")
    .upsert({ code, name: input.name?.trim() || null, created_by: profile.id }, { onConflict: "code" })
    .select("id")
    .single();
  if (error || !data) return fail(errorMessage(error, "Could not save partner"));
  revalidatePath("/travel/b2b");
  return ok({ id: data.id });
}

/** Attach an uploaded PNG/JPG (already in the partner-logos bucket) to a partner. */
export async function setPartnerLogo(code: string, path: string, fileName: string): Promise<ActionResult<{ code: string }>> {
  const profile = await requireProfile();
  const upper = code.trim().toUpperCase();
  if (!path.startsWith(`${upper}/`)) return fail("Upload the logo first");
  const supabase = await createClient();
  const { error } = await supabase
    .from("b2b_partners")
    .upsert({ code: upper, logo_path: path, logo_file_name: fileName, created_by: profile.id }, { onConflict: "code" });
  if (error) return fail(errorMessage(error, "Could not save logo"));
  revalidatePath("/travel/b2b");
  return ok({ code: upper });
}

export async function removePartnerLogo(code: string): Promise<ActionResult<{ code: string }>> {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.from("b2b_partners").update({ logo_path: null, logo_file_name: null }).eq("code", code.trim().toUpperCase());
  if (error) return fail(errorMessage(error, "Could not remove logo"));
  revalidatePath("/travel/b2b");
  return ok({ code });
}
