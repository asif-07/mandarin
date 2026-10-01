/** What the partner scanner shows for a voucher: the live CRM record, never the token. */
export type ScannerVoucher = {
  id: string;
  voucher_no: string;
  group_ref: string;
  status: "active" | "redeemed" | "cancelled";
  transfer_date: string;
  pax: number;
  from_place: string;
  to_place: string;
  transfer_mode: string | null;
  transfer_mode_label: string | null;
  notes: string | null;
  partner_code: string | null;
  ticket: { file_name: string; uploaded_at: string; by: string | null } | null;
  redeemed: { at: string; by: string } | null;
  cancelled_at: string | null;
};
