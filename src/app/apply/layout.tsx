import type { Metadata, Viewport } from "next";
import { COMPANY } from "@/lib/constants";

export const metadata: Metadata = {
  title: { default: `${COMPANY.name} · China visa application`, template: `%s · ${COMPANY.name}` },
  description: "Apply for your China trip online: upload your passport, photo and PAN card, add your PAR, hotel and flight if you have them.",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#1A1A1A" };

export default function ApplyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
