import type { Metadata, Viewport } from "next";
import { GROUND_BRAND } from "@/lib/constants";

export const metadata: Metadata = {
  title: { default: `${GROUND_BRAND.name} · Voucher scanner`, template: `%s · ${GROUND_BRAND.name}` },
  description: "Authorised partner scanner for transfer vouchers.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1, themeColor: "#1A1A1A" };

/** Mobile-first, neutral China Travel Support branding; no CRM shell. */
export default function ScanLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-mr-surface text-mr-ink">
      <header className="border-b border-mr-line bg-white">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <div>
            <p className="font-heading text-base font-semibold leading-tight">{GROUND_BRAND.name}</p>
            <p className="text-[11px] uppercase tracking-[0.18em] text-mr-muted">Partner voucher scanner</p>
          </div>
          <span className="rounded-md bg-mr-ink px-2 py-1 font-heading text-xs font-semibold text-white">{GROUND_BRAND.short}</span>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-5">{children}</main>
      <footer className="mx-auto max-w-lg px-4 pb-8 text-center text-[11px] text-mr-muted">Authorised partners only. Voucher details are shown only to signed-in partners.</footer>
    </div>
  );
}
