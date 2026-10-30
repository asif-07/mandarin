"use client";

import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export type SectionTab = { value: string; label: string; badge?: number | string | null; tone?: "red" | "warning"; content: ReactNode };

/** Compartments on one page: a tab strip with one thing per tab (server-rendered content is passed in as nodes). */
export function SectionTabs({ tabs, defaultValue, className }: { tabs: SectionTab[]; defaultValue?: string; className?: string }) {
  return (
    <Tabs defaultValue={defaultValue ?? tabs[0]?.value} className={cn("gap-5", className)}>
      <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-lg border border-mr-line bg-mr-surface p-1">
        {tabs.map((t) => (
          <TabsTrigger key={t.value} value={t.value} className="h-8 gap-1.5 rounded-md px-3 text-sm data-[state=active]:bg-white data-[state=active]:text-mr-ink data-[state=active]:shadow-xs">
            {t.label}
            {t.badge !== undefined && t.badge !== null && t.badge !== 0 && <span className={cn("tnum rounded-md px-1.5 text-[11px] font-semibold", t.tone === "red" ? "bg-mr-red/10 text-mr-red" : t.tone === "warning" ? "bg-mr-warning/10 text-mr-warning" : "bg-mr-ink/10 text-mr-ink")}>{t.badge}</span>}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((t) => (
        <TabsContent key={t.value} value={t.value} className="mt-0">
          {t.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
