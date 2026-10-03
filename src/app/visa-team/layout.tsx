import type { Metadata, Viewport } from "next";
import { GROUND_BRAND } from "@/lib/constants";

export const metadata: Metadata = {
  title: { default: `${GROUND_BRAND.name} · Visa Team`, template: `%s · Visa Team` },
  description: "China Visa Team extension: process approved groups, upload visas, manage ground operations.",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#1A1A1A" };

export default function VisaTeamLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
