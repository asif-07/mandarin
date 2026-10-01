import Link from "next/link";
import { getScannerPartner } from "@/lib/scanner/auth";
import { loadScannerVoucher } from "@/lib/scanner/vouchers";
import { VoucherVerify } from "@/components/scanner/voucher-verify";
import { GROUND_BRAND } from "@/lib/constants";

export const dynamic = "force-dynamic";

/**
 * The URL inside every voucher QR. A customer or anyone else who scans it sees
 * only this neutral notice; an authorised partner sees the live record.
 */
export default async function ScanVoucherPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const partner = await getScannerPartner();
  if (!partner) {
    return (
      <div className="rounded-lg border border-mr-line bg-white p-5 text-center">
        <p className="font-heading text-lg font-semibold">Transfer voucher</p>
        <p className="mt-2 text-sm text-mr-body">This voucher is verified by an authorised {GROUND_BRAND.name} partner at the meeting point. Please show the PDF you received to the partner representative.</p>
        <p className="mt-5 text-xs text-mr-muted">
          Partner?{" "}
          <Link href={`/scan?next=${encodeURIComponent(`/scan/v/${token}`)}`} className="font-medium text-mr-ink underline">
            Sign in to verify
          </Link>
        </p>
      </div>
    );
  }
  const found = await loadScannerVoucher(token);
  if (!found) {
    return (
      <div className="rounded-lg border border-mr-red/40 bg-white p-5 text-center">
        <p className="font-heading text-lg font-semibold text-mr-red">Voucher not found</p>
        <p className="mt-2 text-sm text-mr-body">This QR code does not match any voucher. Do not accept it.</p>
        <Link href="/scan" className="mt-4 inline-block text-sm font-medium underline">
          Scan another
        </Link>
      </div>
    );
  }
  return <VoucherVerify token={token} initial={found.voucher} partner={partner} />;
}
