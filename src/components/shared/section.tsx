import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Titled block used on the dashboard and inside cards: an icon, a heading,
 * a short count or hint, and an optional "see all" link on the right.
 */
export function Section({ id, title, icon, hint, link, children, className }: { id?: string; title: string; icon?: ReactNode; hint?: ReactNode; link?: { href: string; label: string }; children: ReactNode; className?: string }) {
  return (
    <section aria-labelledby={id} className={cn("mt-8", className)}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={id} className="flex items-center gap-2 text-base font-semibold text-mr-ink [&>svg]:size-4 [&>svg]:text-mr-red">
          {icon}
          {title}
          {hint && <span className="text-sm font-normal text-mr-muted">{hint}</span>}
        </h2>
        {link && (
          <Link href={link.href} className="inline-flex items-center gap-1 text-xs font-medium text-mr-body hover:text-mr-ink">
            {link.label} <ArrowRight className="size-3" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
