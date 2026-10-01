import { NextResponse } from "next/server";
import { getScannerPartner } from "@/lib/scanner/auth";
import { loadScannerVoucher } from "@/lib/scanner/vouchers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — the live voucher record for an authorised partner. Anyone else gets nothing but a 401. */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const partner = await getScannerPartner();
  if (!partner) return NextResponse.json({ error: "Authorised partner sign-in required" }, { status: 401 });
  const { token } = await params;
  const found = await loadScannerVoucher(token);
  if (!found) return NextResponse.json({ error: "Voucher not found" }, { status: 404 });
  return NextResponse.json({ voucher: found.voucher, partner }, { headers: { "cache-control": "no-store" } });
}
