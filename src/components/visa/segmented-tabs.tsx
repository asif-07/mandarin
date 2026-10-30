"use client";

import { useUrlFilters } from "@/components/shared/url-filters";
import { cn } from "@/lib/utils";

export type ViewTab = { value: string; label: string; count: number; tone?: "warning" | "red" | "success" | "muted" };

/** Segmented view tabs (All / Needs review / Missing docs / Grouped) driven by the `view` URL param. */
export function SegmentedTabs({ tabs, active }: { tabs: ViewTab[]; active: string }) {
  const { set } = useUrlFilters();
  const toneClass: Record<NonNullable<ViewTab["tone"]>, string> = { warning: "text-mr-warning", red: "text-mr-red", success: "text-mr-success", muted: "text-mr-muted" };
  return (
    <div className="flex items-center gap-1 overflow-x-auto rounded-lg border border-mr-line bg-mr-surface p-1 text-xs font-medium" role="tablist" aria-label="View">
      {tabs.map((t) => {
        const isActive = t.value === active;
        return (
          <button key={t.value} type="button" role="tab" aria-selected={isActive} onClick={() => set({ view: t.value === "all" ? null : t.value })} className={cn("whitespace-nowrap rounded-md px-3 py-1.5 transition-colors", isActive ? "bg-white text-mr-ink shadow-xs" : "text-mr-body hover:text-mr-ink")}>
            {t.label} <span className={cn("ml-1 tnum", isActive ? "text-mr-muted" : t.tone ? toneClass[t.tone] : "text-mr-muted")}>{t.count}</span>
          </button>
        );
      })}
    </div>
  );
}
