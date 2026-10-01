import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { ScannerPartnersManager } from "@/components/settings/scanner-partners-manager";
import { listScannerPartners } from "@/lib/actions/transfer-vouchers";

export const metadata: Metadata = { title: "Voucher scanner partners" };

export default async function ScannerPartnersPage() {
  const partners = await listScannerPartners();
  return (
    <>
      <PageHeader
        title="Voucher scanner partners"
        description="Authorised ground partners sign in to the China Travel Support scanner with their access key, scan the customer's voucher QR, upload the transport ticket and redeem the voucher once."
        actions={
          <Link href="/settings" className="text-sm text-mr-body hover:text-mr-ink hover:underline">
            Back to settings
          </Link>
        }
      />
      <ScannerPartnersManager partners={partners} />
    </>
  );
}
