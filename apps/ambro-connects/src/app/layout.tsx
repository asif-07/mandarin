import type { Metadata, Viewport } from "next";
import { Shell } from "@/components/shell";
import "./globals.css";
import "./mobile-shell.css";

export const metadata: Metadata = {
  title: {
    default: "Ambro Connects — China, through people.",
    template: "%s · Ambro Connects",
  },
  description:
    "Meet the people behind the possibilities. A network connecting China-based professionals with Ambro’s global Mandarin Roots community.",
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7f6f2",
  viewportFit: "cover",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
