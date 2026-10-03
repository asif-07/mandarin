import Link from "next/link";
import type { ReactNode } from "react";
import { GROUND_BRAND } from "@/lib/constants";
import { SignOutButton } from "@/components/portal/sign-out-button";
import { cn } from "@/lib/utils";

/** Frame for the external portals (B2B partner, China Visa Team): neutral China Travel Support branding, no CRM shell. */
export function PortalShell({ title, subtitle, nav, user, signOutUrl, homeHref, children, wide = false }: { title: string; subtitle: string; nav?: { href: string; label: string; badge?: number }[]; user?: string | null; signOutUrl?: string; homeHref: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-dvh bg-mr-surface text-mr-ink">
      <header className="border-b border-mr-line bg-white">
        <div className={cn("mx-auto flex items-center justify-between gap-3 px-4 py-3", wide ? "max-w-6xl" : "max-w-3xl")}>
          <Link href={homeHref} className="min-w-0">
            <p className="truncate font-heading text-base font-semibold leading-tight">{title}</p>
            <p className="truncate text-[11px] uppercase tracking-[0.18em] text-mr-muted">{subtitle}</p>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            {user && <span className="hidden text-xs text-mr-body sm:inline">{user}</span>}
            <span className="rounded-md bg-mr-ink px-2 py-1 font-heading text-xs font-semibold text-white">{GROUND_BRAND.short}</span>
            {signOutUrl && <SignOutButton url={signOutUrl} />}
          </div>
        </div>
        {nav && nav.length > 0 && (
          <nav className={cn("mx-auto flex gap-1 overflow-x-auto px-4", wide ? "max-w-6xl" : "max-w-3xl")} aria-label="Portal">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className="inline-flex h-9 items-center gap-1 whitespace-nowrap border-b-2 border-transparent px-2 text-sm text-mr-body hover:text-mr-ink">
                {n.label}
                {n.badge ? <span className="rounded-full bg-mr-red px-1.5 text-[10px] font-semibold text-white">{n.badge}</span> : null}
              </Link>
            ))}
          </nav>
        )}
      </header>
      <main className={cn("mx-auto px-4 py-5", wide ? "max-w-6xl" : "max-w-3xl")}>{children}</main>
      <footer className={cn("mx-auto px-4 pb-8 text-center text-[11px] text-mr-muted", wide ? "max-w-6xl" : "max-w-3xl")}>{GROUND_BRAND.name} · authorised access only</footer>
    </div>
  );
}
