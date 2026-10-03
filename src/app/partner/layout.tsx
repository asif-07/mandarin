import type { Metadata, Viewport } from "next";
import { GROUND_BRAND } from "@/lib/constants";

export const metadata: Metadata = {
  title: { default: `${GROUND_BRAND.name} · Partner portal`, template: `%s · Partner portal` },
  description: "B2B partner portal: submit groups, follow visa processing, download approved visas.",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#1A1A1A" };

export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
