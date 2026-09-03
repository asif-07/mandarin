"use client";

import { Suspense } from "react";
import { Columns3, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClearFilters, SearchParamInput, SelectParam, useUrlFilters } from "@/components/shared/url-filters";
import { COUNTRIES, ENQUIRY_TYPES, LEAD_SOURCES, LEAD_STATUSES } from "@/lib/constants";
import { cn } from "@/lib/utils";

function ViewToggle() {
  const { get, set } = useUrlFilters();
  const view = get("view") === "table" ? "table" : "board";
  return (
    <div className="inline-flex rounded-md border border-mr-line p-0.5" role="group" aria-label="View">
      <Button
        variant="ghost"
        size="sm"
        className={cn("h-7", view === "board" && "bg-mr-surface text-mr-ink")}
        aria-pressed={view === "board"}
        onClick={() => set({ view: null })}
      >
        <Columns3 /> Board
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={cn("h-7", view === "table" && "bg-mr-surface text-mr-ink")}
        aria-pressed={view === "table"}
        onClick={() => set({ view: "table" })}
      >
        <List /> Table
      </Button>
    </div>
  );
}

export function LeadFilters({ profiles }: { profiles: { value: string; label: string }[] }) {
  return (
    <Suspense>
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
        <SearchParamInput placeholder="Search name, phone or ref" className="md:w-64" />
        <SelectParam name="status" options={LEAD_STATUSES} placeholder="Status" allLabel="All statuses" className="md:w-[150px]" />
        <SelectParam name="type" options={ENQUIRY_TYPES.map((t) => ({ value: t.value, label: t.short }))} placeholder="Enquiry" allLabel="All enquiries" className="md:w-[150px]" />
        <SelectParam name="country" options={COUNTRIES} placeholder="Country" allLabel="All countries" className="md:w-[140px]" />
        <SelectParam name="source" options={LEAD_SOURCES} placeholder="Source" allLabel="All sources" className="md:w-[140px]" />
        <SelectParam name="owner" options={profiles} placeholder="Owner" allLabel="Anyone" className="md:w-[130px]" />
        <ClearFilters keys={["q", "status", "type", "country", "source", "owner"]} />
        <div className="md:ml-auto">
          <ViewToggle />
        </div>
      </div>
    </Suspense>
  );
}
