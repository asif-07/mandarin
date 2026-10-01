import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getScannerPartner } from "@/lib/scanner/auth";
import { loadScannerVoucher } from "@/lib/scanner/vouchers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST — redeem the voucher once the ticket is attached. The update is
 * conditional on status = active, so two partners scanning at once cannot both
 * redeem; the loser sees VOUCHER ALREADY REDEEMED with who and when.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const partner = await getScannerPartner();
  if (!partner) return NextResponse.json({ error: "Authorised partner sign-in required" }, { status: 401 });
  const { token } = await params;
  const found = await loadScannerVoucher(token);
  if (!found) return NextResponse.json({ error: "Voucher not found" }, { status: 404 });
  if (found.voucher.status === "redeemed") return NextResponse.json({ error: "VOUCHER ALREADY REDEEMED", voucher: found.voucher }, { status: 409 });
  if (found.voucher.status === "cancelled") return NextResponse.json({ error: "This voucher was cancelled", voucher: found.voucher }, { status: 409 });
  if (!found.raw.ticket_path) return NextResponse.json({ error: "Upload the transport ticket before redeeming", voucher: found.voucher }, { status: 400 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("transfer_vouchers")
    .update({ status: "redeemed", redeemed_at: new Date().toISOString(), redeemed_partner_id: partner.id })
    .eq("id", found.raw.id)
    .eq("status", "active")
    .select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const fresh = await loadScannerVoucher(token);
  if (!data || data.length === 0) return NextResponse.json({ error: "VOUCHER ALREADY REDEEMED", voucher: fresh?.voucher ?? found.voucher }, { status: 409 });
  return NextResponse.json({ ok: true, voucher: fresh?.voucher ?? found.voucher });
}
