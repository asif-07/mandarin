import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { TRANSFER_MODES, labelFor } from "@/lib/constants";
import { groupRef } from "@/lib/queries/travel";
import type { ScannerVoucher } from "@/lib/scanner/types";

const SELECT = "id, voucher_no, status, transfer_date, pax, from_place, to_place, transfer_mode, notes, ticket_file_name, ticket_uploaded_at, redeemed_at, cancelled_at, group:travel_groups!transfer_vouchers_group_id_fkey(group_ref, reference_prefix, partner_code, travel_date, travel_end_date, group_code), ticket_partner:scanner_partners!transfer_vouchers_ticket_partner_id_fkey(code, name), redeemed_partner:scanner_partners!transfer_vouchers_redeemed_partner_id_fkey(code, name)";

/** The live voucher record behind a QR token, for an authorised partner. Runs with the service role; callers must check the partner first. */
export async function loadScannerVoucher(token: string): Promise<{ voucher: ScannerVoucher; raw: { id: string; status: string; ticket_path: string | null } } | null> {
  if (!token || token.length < 16 || token.length > 128) return null;
  const supabase = createAdminClient();
  const { data: v } = await supabase.from("transfer_vouchers").select(SELECT).eq("token", token).maybeSingle();
  if (!v || !v.group) return null;
  const voucher: ScannerVoucher = {
    id: v.id,
    voucher_no: v.voucher_no,
    group_ref: v.group.group_ref ?? groupRef(v.group),
    status: (v.status === "redeemed" || v.status === "cancelled" ? v.status : "active") as ScannerVoucher["status"],
    transfer_date: v.transfer_date,
    pax: v.pax,
    from_place: v.from_place,
    to_place: v.to_place,
    transfer_mode: v.transfer_mode,
    transfer_mode_label: v.transfer_mode ? labelFor(TRANSFER_MODES, v.transfer_mode) : null,
    notes: v.notes,
    partner_code: v.group.partner_code,
    ticket: v.ticket_file_name && v.ticket_uploaded_at ? { file_name: v.ticket_file_name, uploaded_at: v.ticket_uploaded_at, by: v.ticket_partner ? `${v.ticket_partner.code} · ${v.ticket_partner.name}` : null } : null,
    redeemed: v.redeemed_at ? { at: v.redeemed_at, by: v.redeemed_partner ? `${v.redeemed_partner.code} · ${v.redeemed_partner.name}` : "partner" } : null,
    cancelled_at: v.cancelled_at,
  };
  const { data: raw } = await supabase.from("transfer_vouchers").select("id, status, ticket_path").eq("id", v.id).single();
  return { voucher, raw: raw ?? { id: v.id, status: v.status, ticket_path: null } };
}
