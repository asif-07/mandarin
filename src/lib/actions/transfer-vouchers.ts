"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { generateAccessKey, generateVoucherToken, hashAccessKey } from "@/lib/scanner/auth";
import { groupRef } from "@/lib/queries/travel";
import { TRANSFER_MODES } from "@/lib/constants";
import { errorMessage, fail, ok, type ActionResult } from "@/lib/result";

const modeValues = TRANSFER_MODES.map((m) => m.value) as [string, ...string[]];

const voucherSchema = z.object({
  group_id: z.string().uuid(),
  group_service_id: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ? v : null))
    .refine((v) => !v || z.string().uuid().safeParse(v).success, "Invalid service"),
  from_place: z.string().trim().min(1, "Where does the transfer start?").max(200),
  to_place: z.string().trim().min(1, "Where does it go?").max(200),
  transfer_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the transfer date"),
  pax: z.coerce.number().int().positive("How many passengers?").max(9999),
  transfer_mode: z
    .enum(modeValues)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  notes: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
});
export type VoucherInput = z.input<typeof voucherSchema>;

export type TransferVoucherRow = {
  id: string;
  group_id: string;
  group_service_id: string | null;
  voucher_no: string;
  status: string;
  from_place: string;
  to_place: string;
  transfer_date: string;
  pax: number;
  transfer_mode: string | null;
  notes: string | null;
  issued_at: string;
  ticket_path: string | null;
  ticket_file_name: string | null;
  ticket_uploaded_at: string | null;
  redeemed_at: string | null;
  redeemed_partner: { code: string; name: string } | null;
};

function revalidateVouchers(groupId?: string) {
  revalidatePath("/travel");
  revalidatePath("/travel/b2b");
  revalidatePath("/travel/transfers");
  revalidatePath("/");
  void groupId;
}

/**
 * Issue a transfer voucher from a group: the group's data is pulled in, the
 * route stays editable, and a unique QR token is generated. The voucher
 * number is the Group ID plus TV01, TV02 … in issue order.
 */
export async function issueTransferVoucher(input: VoucherInput): Promise<ActionResult<{ id: string; voucher_no: string }>> {
  const profile = await requireProfile();
  const parsed = voucherSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check the voucher details", z.flattenError(parsed.error).fieldErrors);
  const v = parsed.data;
  const supabase = await createClient();
  const { data: group } = await supabase.from("travel_groups").select("id, group_ref, reference_prefix, partner_code, travel_date, travel_end_date, group_code").eq("id", v.group_id).maybeSingle();
  if (!group) return fail("Group not found");
  const ref = group.group_ref ?? groupRef(group);

  // Next TV number for this group; retry once on a collision with a parallel issue.
  for (let attempt = 0; attempt < 3; attempt++) {
    const { count } = await supabase.from("transfer_vouchers").select("id", { count: "exact", head: true }).eq("group_id", group.id);
    const voucherNo = `${ref}-TV${String((count ?? 0) + 1 + attempt).padStart(2, "0")}`;
    const { data, error } = await supabase
      .from("transfer_vouchers")
      .insert({
        group_id: group.id,
        group_service_id: v.group_service_id,
        voucher_no: voucherNo,
        token: generateVoucherToken(),
        from_place: v.from_place,
        to_place: v.to_place,
        transfer_date: v.transfer_date,
        pax: v.pax,
        transfer_mode: v.transfer_mode,
        notes: v.notes,
        issued_by: profile.id,
      })
      .select("id, voucher_no")
      .single();
    if (!error && data) {
      revalidateVouchers(group.id);
      return ok(data);
    }
    if (error?.code !== "23505") return fail(errorMessage(error, "Could not issue the voucher"));
  }
  return fail("Could not assign a voucher number, please try again");
}

/** Cancel an unused voucher so its QR no longer verifies. A redeemed voucher stays as the settlement record. */
export async function cancelTransferVoucher(id: string): Promise<ActionResult<{ id: string }>> {
  await requireProfile();
  const supabase = await createClient();
  const { data: cur } = await supabase.from("transfer_vouchers").select("id, status, group_id").eq("id", id).maybeSingle();
  if (!cur) return fail("Voucher not found");
  if (cur.status === "redeemed") return fail("This voucher was already redeemed and is kept for settlement");
  const { error } = await supabase.from("transfer_vouchers").update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("id", id);
  if (error) return fail(errorMessage(error, "Could not cancel the voucher"));
  revalidateVouchers(cur.group_id);
  return ok({ id });
}

/** Signed link to the transport ticket a partner uploaded (CRM staff only). */
export async function ticketDownloadUrl(voucherId: string): Promise<ActionResult<{ url: string }>> {
  await requireProfile();
  const supabase = await createClient();
  const { data: v } = await supabase.from("transfer_vouchers").select("ticket_path, ticket_file_name").eq("id", voucherId).maybeSingle();
  if (!v?.ticket_path) return fail("No ticket uploaded yet");
  const { data, error } = await supabase.storage.from("transfer-tickets").createSignedUrl(v.ticket_path, 300, { download: v.ticket_file_name ?? undefined });
  if (error || !data) return fail(errorMessage(error, "Could not open the ticket"));
  return ok({ url: data.signedUrl });
}

// ---------------------------------------------------------------------------
// Scanner partners (the authorised ground partners who verify vouchers)
// ---------------------------------------------------------------------------
export type ScannerPartnerRow = { id: string; code: string; name: string; active: boolean; last_seen_at: string | null; created_at: string | null };

export async function listScannerPartners(): Promise<ScannerPartnerRow[]> {
  await requireProfile();
  const supabase = await createClient();
  const { data } = await supabase.from("scanner_partners").select("id, code, name, active, last_seen_at, created_at").order("code");
  return data ?? [];
}

/** Create a partner and return their access key once; only its hash is stored. */
export async function createScannerPartner(input: { code: string; name: string }): Promise<ActionResult<{ id: string; access_key: string }>> {
  const profile = await requireProfile();
  const code = input.code.trim().toUpperCase();
  const name = input.name.trim();
  if (!/^[A-Z0-9]{2,12}$/.test(code)) return fail("Code: 2 to 12 letters or digits");
  if (!name) return fail("Name is required");
  const key = generateAccessKey();
  const supabase = await createClient();
  const { data, error } = await supabase.from("scanner_partners").insert({ code, name, access_key_hash: hashAccessKey(key), created_by: profile.id }).select("id").single();
  if (error || !data) {
    if (error?.code === "23505") return fail(`Partner code ${code} already exists`);
    return fail(errorMessage(error, "Could not create the partner"));
  }
  revalidatePath("/settings/scanner-partners");
  return ok({ id: data.id, access_key: key });
}

/** Issue a fresh access key (the old one stops working immediately). */
export async function rotateScannerPartnerKey(id: string): Promise<ActionResult<{ access_key: string }>> {
  await requireProfile();
  const key = generateAccessKey();
  const supabase = await createClient();
  const { error } = await supabase.from("scanner_partners").update({ access_key_hash: hashAccessKey(key) }).eq("id", id);
  if (error) return fail(errorMessage(error, "Could not rotate the key"));
  revalidatePath("/settings/scanner-partners");
  return ok({ access_key: key });
}

export async function setScannerPartnerActive(id: string, active: boolean): Promise<ActionResult<{ id: string }>> {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.from("scanner_partners").update({ active }).eq("id", id);
  if (error) return fail(errorMessage(error, "Could not update the partner"));
  revalidatePath("/settings/scanner-partners");
  return ok({ id });
}
