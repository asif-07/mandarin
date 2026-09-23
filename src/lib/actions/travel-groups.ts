"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { bulkGroupSchema, groupSchema, hotelFields, hotelStars, transitLocation, type BulkGroupInput, type GroupInput } from "@/lib/validation/travel";
import { errorMessage, fail, ok, type ActionResult } from "@/lib/result";
import { formatDate, todayISO } from "@/lib/format";
import { BUCKETS, PACKAGE_TIERS } from "@/lib/constants";
import { markGroupVisaApproved } from "@/lib/travel/visa";
import { b2bReference, parseB2bCode } from "@/lib/travel/b2b-code";
import { groupPackReference } from "@/lib/queries/travel";

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
  group_ref?: string | null;
  traveller_count: number;
};

/** The code the next group created on a date will receive (G01 when the day is empty). */
export async function nextGroupCodeFor(date: string): Promise<string> {
  await requireProfile();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "G01";
  const supabase = await createClient();
  const { data } = await supabase.rpc("next_group_code", { p_date: date });
  return typeof data === "string" ? data : "G01";
}

/** Create one of our own groups. The G-code is assigned by the database: the next free one on that date. */
export async function createGroup(input: GroupInput): Promise<ActionResult<{ id: string; group_code: string }>> {
  await requireProfile();
  const parsed = groupSchema.safeParse({ ...input, group_code: "G01" });
  if (!parsed.success) return fail("Please fix the highlighted fields", z.flattenError(parsed.error).fieldErrors);
  const supabase = await createClient();
  const { group_code: _ignored, ...fields } = parsed.data;
  void _ignored;
  const { data, error } = await supabase.rpc("create_travel_group", { p: fields });
  const row = data as { id?: string; group_code?: string } | null;
  if (error || !row?.id || !row.group_code) return fail(errorMessage(error, "Could not create group"));
  revalidateTravel();
  return ok({ id: row.id, group_code: row.group_code });
}

/** Creates N more groups on a date; each takes the next free code (G03, G04, … after G01 and G02). */
export async function bulkCreateGroups(input: BulkGroupInput): Promise<ActionResult<{ created: number; skipped: number; first: string | null; last: string | null }>> {
  await requireProfile();
  const parsed = bulkGroupSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields", z.flattenError(parsed.error).fieldErrors);
  const supabase = await createClient();
  const { count, ...fields } = parsed.data;
  let first: string | null = null;
  let last: string | null = null;
  for (let i = 0; i < count; i++) {
    const { data, error } = await supabase.rpc("create_travel_group", { p: fields });
    const row = data as { group_code?: string } | null;
    if (error || !row?.group_code) return fail(errorMessage(error, `Could not create group ${i + 1} of ${count}`));
    first ??= row.group_code;
    last = row.group_code;
  }
  revalidateTravel();
  return ok({ created: count, skipped: 0, first, last });
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
  const today = todayISO();
  const select = "id, travel_date, travel_end_date, group_code, label, guide_name, reference_prefix, entry_port, exit_port, source, partner_code, pax_expected, group_ref, travellers(count)";
  const applyQuery = <T extends { gte: (c: string, v: string) => T; lte: (c: string, v: string) => T; or: (f: string) => T }>(req: T): T => {
    if (!q) return req;
    const range = dateRange(q);
    if (range) return req.gte("travel_date", range[0]).lte("travel_date", range[1]);
    const like = `%${q.replace(/[%,()]/g, "")}%`;
    return req.or(`group_code.ilike.${like},label.ilike.${like},guide_name.ilike.${like},group_ref.ilike.${like}`);
  };
  // Soonest departure first: today's and upcoming groups in date order, then past groups most recent first.
  const [{ data: upcoming }, { data: past }] = await Promise.all([
    applyQuery(supabase.from("travel_groups").select(select).gte("travel_date", today).order("travel_date", { ascending: true }).order("group_code", { ascending: true }).limit(limit)),
    applyQuery(supabase.from("travel_groups").select(select).lt("travel_date", today).order("travel_date", { ascending: false }).order("group_code", { ascending: true }).limit(limit)),
  ]);
  return [...(upcoming ?? []), ...(past ?? [])].slice(0, limit).map((g) => ({
    id: g.id,
    travel_date: g.travel_date,
    travel_end_date: g.travel_end_date,
    group_code: g.group_code,
    label: g.label,
    guide_name: g.guide_name,
    group_ref: g.group_ref,
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
  partner_group: string | null;
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
  transit_location: transitLocation,
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
  const { error: partnerError } = await supabase.from("b2b_partners").upsert({ code: v.partner_code, created_by: profile.id }, { onConflict: "code", ignoreDuplicates: true });
  if (partnerError) console.error("partner upsert failed", partnerError.message);
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
 * File a received visa PDF under the group. Photos go through
 * POST /api/groups/:id/visa instead: that route converts them with sharp,
 * whose binaries are only bundled for API routes on Vercel.
 */
export async function registerGroupVisa(groupId: string, uploadPath: string, originalName: string): Promise<ActionResult<{ file_name: string }>> {
  const profile = await requireProfile();
  if (!uploadPath.startsWith("_visa/incoming/")) return fail("Upload the visa file first");
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
  const { error: moveError } = await supabase.storage.from(BUCKETS.travelPacks).move(uploadPath, finalPath);
  if (moveError) return fail(errorMessage(moveError, "Could not file the visa"));
  const res = await recordGroupVisa(supabase, groupId, profile.id, finalPath, fileName);
  if (!res.ok) return res;
  return ok({ file_name: `${fileName} (from ${originalName})` });
}

/** Store the filed visa on the group and move travellers to Visa Approved. Shared with the photo upload route. */
export async function recordGroupVisa(supabase: Awaited<ReturnType<typeof createClient>>, groupId: string, profileId: string, finalPath: string, fileName: string): Promise<ActionResult<{ file_name: string }>> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("travel_groups")
    .update({ visa_status: "approved", visa_path: finalPath, visa_file_name: fileName, visa_uploaded_at: now, visa_uploaded_by: profileId })
    .eq("id", groupId);
  if (error) return fail(errorMessage(error, "Could not record the visa"));
  await supabase.from("travel_groups").update({ visa_applied_at: now }).eq("id", groupId).is("visa_applied_at", null);
  await markGroupVisaApproved(supabase, groupId);
  revalidateTravel();
  revalidatePath("/travel/b2b");
  return ok({ file_name: fileName });
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
export type PartnerRow = { id: string; code: string; name: string | null; phone: string | null; email: string | null; address: string | null; logo_path: string | null; logo_file_name: string | null };

export async function listPartners(): Promise<PartnerRow[]> {
  await requireProfile();
  const supabase = await createClient();
  const { data } = await supabase.from("b2b_partners").select("id, code, name, phone, email, address, logo_path, logo_file_name").order("code");
  return data ?? [];
}

export async function savePartner(input: { code: string; name?: string | null; phone?: string | null; email?: string | null; address?: string | null }): Promise<ActionResult<{ id: string }>> {
  const profile = await requireProfile();
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z0-9]{2,12}$/.test(code)) return fail("Partner code: 2–12 letters or digits, e.g. EDPT");
  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) return fail("That email address does not look right");
  const supabase = await createClient();
  // Only the fields supplied are written, so a name edit never blanks the phone and so on.
  const patch: Record<string, string | null> = { code };
  (["name", "phone", "email", "address"] as const).forEach((k) => {
    if (input[k] !== undefined) patch[k] = input[k]?.toString().trim().slice(0, 500) || null;
  });
  const { data, error } = await supabase
    .from("b2b_partners")
    .upsert({ ...patch, code, created_by: profile.id }, { onConflict: "code" })
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
