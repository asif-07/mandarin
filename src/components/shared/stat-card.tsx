import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StatTone = "ink" | "red" | "success" | "warning" | "neutral";

const ACCENT: Record<StatTone, string> = {
  ink: "bg-mr-ink",
  red: "bg-mr-red",
  success: "bg-mr-success",
  warning: "bg-mr-warning",
  neutral: "bg-mr-line",
};
const VALUE: Record<StatTone, string> = {
  ink: "text-mr-ink",
  red: "text-mr-red",
  success: "text-mr-success",
  warning: "text-mr-warning",
  neutral: "text-mr-body",
};

/**
 * One number with a label and a hint. A coloured bar on the left carries the
 * meaning (red = needs action, amber = pending, green = clear) so a row of
 * tiles reads at a glance. Pass `href` to make the whole tile a link.
 */
export function StatCard({ label, value, hint, tone = "ink", href, icon, className }: { label: string; value: ReactNode; hint?: ReactNode; tone?: StatTone; href?: string; icon?: ReactNode; className?: string }) {
  const body = (
    <>
      <span className={cn("absolute inset-y-3 left-0 w-1 rounded-r", ACCENT[tone])} aria-hidden />
      <div className="flex items-start justify-between gap-2">
        <p className="micro-label truncate">{label}</p>
        {icon && <span className="text-mr-muted [&>svg]:size-4">{icon}</span>}
      </div>
      <p className={cn("tnum mt-1.5 truncate font-heading text-2xl font-semibold leading-none sm:text-[26px]", VALUE[tone])}>{value}</p>
      {hint && <p className="mt-1.5 truncate text-xs text-mr-muted">{hint}</p>}
    </>
  );
  const base = cn("relative block min-w-0 rounded-lg border border-mr-line bg-white py-3 pl-4 pr-3", className);
  return href ? (
    <Link href={href} className={cn(base, "transition-colors hover:border-mr-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mr-ink")}>
      {body}
    </Link>
  ) : (
    <div className={base}>{body}</div>
  );
}

/** Responsive row of stat tiles: 2 on phones, 3 on tablets, up to `cols` on wide screens. */
export function StatGrid({ children, cols = 4, className }: { children: ReactNode; cols?: 3 | 4 | 5 | 6; className?: string }) {
  const wide = { 3: "xl:grid-cols-3", 4: "xl:grid-cols-4", 5: "xl:grid-cols-5", 6: "xl:grid-cols-6" }[cols];
  return <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3", wide, className)}>{children}</div>;
}
