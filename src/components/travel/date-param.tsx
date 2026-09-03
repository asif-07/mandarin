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
