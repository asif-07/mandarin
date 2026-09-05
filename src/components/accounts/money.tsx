import { formatMoney } from "@/lib/format";
import type { CurrencyTotals } from "@/lib/queries/accounts";
import { cn } from "@/lib/utils";

const ORDER = ["USD", "AED", "CNY", "INR"];

export function sortedTotals(totals: CurrencyTotals): [string, number][] {
  return Object.entries(totals)
    .filter(([, v]) => v !== 0)
    .sort(([a], [b]) => ORDER.indexOf(a) - ORDER.indexOf(b));
}

/**
 * One line per currency. Amounts in different currencies are never added
 * together, so a mixed book shows "USD 1,200.00" and "AED 350.00" side by side.
 */
export function Totals({
  totals,
  empty = "—",
  size = "md",
  tone,
  className,
}: {
  totals: CurrencyTotals;
  empty?: string;
  size?: "sm" | "md" | "lg";
  tone?: "positive" | "negative" | "auto";
  className?: string;
}) {
  const entries = sortedTotals(totals);
  if (entries.length === 0) return <span className={cn("text-mr-muted", className)}>{empty}</span>;
  return (
    <span className={cn("tnum flex flex-col", size === "lg" ? "gap-0.5" : "gap-0", className)}>
      {entries.map(([c, v]) => (
        <span
          key={c}
          className={cn(
            size === "lg" && "font-heading text-2xl font-semibold leading-tight",
            size === "md" && "text-sm font-medium",
            size === "sm" && "text-xs",
            (tone === "negative" || (tone === "auto" && v < 0)) && "text-mr-red",
            (tone === "positive" || (tone === "auto" && v > 0)) && "text-mr-success",
          )}
        >
          {formatMoney(v, c)}
        </span>
      ))}
    </span>
  );
}

/** Stat tile used across the accounts pages. */
export function MoneyStat({ label, totals, hint, tone, empty }: { label: string; totals: CurrencyTotals; hint?: string; tone?: "positive" | "negative" | "auto"; empty?: string }) {
  return (
    <div className="rounded-lg border border-mr-line bg-white p-5">
      <p className="micro-label">{label}</p>
      <div className="mt-2">
        <Totals totals={totals} size="lg" tone={tone} empty={empty ?? "USD 0.00"} />
      </div>
      {hint && <p className="mt-1 text-xs text-mr-muted">{hint}</p>}
    </div>
  );
}

export function Amount({ value, currency, className, signed }: { value: number | string; currency: string; className?: string; signed?: "in" | "out" }) {
  const n = Number(value);
  return (
    <span className={cn("tnum whitespace-nowrap", signed === "in" && "text-mr-success", signed === "out" && "text-mr-red", className)}>
      {signed === "out" ? "−" : signed === "in" ? "+" : ""}
      {formatMoney(Math.abs(n), currency)}
    </span>
  );
}
