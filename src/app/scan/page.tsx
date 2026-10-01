import { getScannerPartner } from "@/lib/scanner/auth";
import { ScannerLogin } from "@/components/scanner/scanner-login";
import { ScannerHome } from "@/components/scanner/scanner-home";

export const dynamic = "force-dynamic";

export default async function ScanPage() {
  const partner = await getScannerPartner();
  if (!partner) return <ScannerLogin />;
  return <ScannerHome partner={partner} />;
}
