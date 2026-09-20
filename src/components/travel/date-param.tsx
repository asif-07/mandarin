"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DatePicker } from "@/components/shared/date-picker";
import { buttonVariants } from "@/components/ui/button";
import { useUrlFilters } from "@/components/shared/url-filters";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Date picker bound to ?date= plus quick links to neighbouring dates that have groups. */
export function TravelDateNav({ date, prev, next, nearby }: { date: string; prev: string | null; next: string | null; nearby: string[] }) {
  const { set } = useUrlFilters();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={prev ? `/travel?date=${prev}` : "#"}
        aria-disabled={!prev}
        aria-label="Previous travel date"
        className={cn(buttonVariants({ variant: "outline", size: "icon" }), !prev && "pointer-events-none opacity-40")}
      >
        <ChevronLeft />
      </Link>
      <DatePicker value={date} onChange={(v) => set({ date: v })} className="w-[170px]" />
      <Link
        href={next ? `/travel?date=${next}` : "#"}
        aria-disabled={!next}
        aria-label="Next travel date"
        className={cn(buttonVariants({ variant: "outline", size: "icon" }), !next && "pointer-events-none opacity-40")}
      >
        <ChevronRight />
      </Link>
      <div className="hidden items-center gap-1 md:flex">
        {nearby.map((d) => (
          <Link
            key={d}
            href={`/travel?date=${d}`}
            className={cn(
              "rounded-md px-2 py-1 text-xs",
              d === date ? "bg-mr-ink text-white" : "bg-mr-surface text-mr-body hover:text-mr-ink",
            )}
          >
            {formatDate(d)}
          </Link>
        ))}
      </div>
    </div>
  );
}

export type RangeView = "day" | "week" | "month" | "quarter";

const VIEWS: { value: RangeView; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "quarter", label: "3 months" },
];

/**
 * Day / week / month / 3-month switcher for the by-group view, with
 * previous / next for the chosen unit, a jump to the current period, and a
 * month picker for any month.
 */
export function TravelRangeNav({ view, date, today, prev, next, nearby, rangeLabel }: { view: RangeView; date: string; today: string; prev: string | null; next: string | null; nearby: string[]; rangeLabel: string }) {
  const { set } = useUrlFilters();
  const href = (v: RangeView, d: string) => `/travel?view=${v}&date=${d}`;
  const unit = view === "week" ? "week" : view === "month" ? "month" : view === "quarter" ? "3 months" : "date";
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-mr-line bg-white p-0.5" role="tablist" aria-label="Range">
          {VIEWS.map((v) => (
            <Link key={v.value} role="tab" aria-selected={view === v.value} href={href(v.value, date)} className={cn("rounded-md px-3 py-1.5 text-sm", view === v.value ? "bg-mr-ink text-white" : "text-mr-body hover:text-mr-ink")}>
              {v.label}
            </Link>
          ))}
        </div>
        <Link href={href(view, today)} className={buttonVariants({ variant: "outline", size: "sm" })}>
          {view === "day" ? "Today" : view === "week" ? "This week" : view === "month" ? "This month" : "Next 3 months"}
        </Link>
        {view !== "day" && (
          <Link href={next ? href(view, next) : "#"} aria-disabled={!next} className={cn(buttonVariants({ variant: "outline", size: "sm" }), !next && "pointer-events-none opacity-40")}>
            {view === "week" ? "Next week" : view === "month" ? "Next month" : "Following 3 months"}
          </Link>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Link href={prev ? href(view, prev) : "#"} aria-disabled={!prev} aria-label={`Previous ${unit}`} className={cn(buttonVariants({ variant: "outline", size: "icon" }), !prev && "pointer-events-none opacity-40")}>
          <ChevronLeft />
        </Link>
        {view === "month" || view === "quarter" ? (
          <input
            type="month"
            aria-label="Pick a month"
            value={date.slice(0, 7)}
            onChange={(e) => e.target.value && set({ view, date: `${e.target.value}-01` })}
            className="h-9 rounded-lg border border-mr-line bg-white px-3 text-sm text-mr-ink"
          />
        ) : (
          <DatePicker value={date} onChange={(v) => set({ view, date: v })} className="w-[170px]" />
        )}
        <Link href={next ? href(view, next) : "#"} aria-disabled={!next} aria-label={`Next ${unit}`} className={cn(buttonVariants({ variant: "outline", size: "icon" }), !next && "pointer-events-none opacity-40")}>
          <ChevronRight />
        </Link>
        <span className="text-sm text-mr-body">{rangeLabel}</span>
        {view === "day" && (
          <div className="hidden items-center gap-1 md:flex">
            {nearby.map((d) => (
              <Link key={d} href={href("day", d)} className={cn("rounded-md px-2 py-1 text-xs", d === date ? "bg-mr-ink text-white" : "bg-mr-surface text-mr-body hover:text-mr-ink")}>
                {formatDate(d)}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
