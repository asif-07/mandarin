import type { Metadata, Viewport } from "next";
import { GROUND_BRAND } from "@/lib/constants";

export const metadata: Metadata = {
  title: { default: `${GROUND_BRAND.name} · Hong Kong group arrival details`, template: `%s · ${GROUND_BRAND.name}` },
  description: "Share your group's Hong Kong arrival details for the airport transfer.",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#1A1A1A" };

export default function ArrivalsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
