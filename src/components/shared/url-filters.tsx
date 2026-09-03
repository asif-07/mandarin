"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/shared/date-picker";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Hook: read/write URL search params, resetting the page on every change. */
export function useUrlFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const set = useCallback(
    (updates: Record<string, string | null | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([k, v]) => {
        if (v === null || v === undefined || v === "") params.delete(k);
        else params.set(k, v);
      });
      params.delete("page");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  return { get: (k: string) => searchParams.get(k) ?? "", set, searchParams };
}

/** Debounced (300ms) free-text search bound to the `q` URL param. */
export function SearchParamInput({ placeholder = "Search", className }: { placeholder?: string; className?: string }) {
  const { get, set } = useUrlFilters();
  const initial = get("q");
  const [value, setValue] = useState(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const last = useRef(initial);

  useEffect(() => {
    if (initial !== last.current) {
      last.current = initial;
      setValue(initial);
    }
  }, [initial]);

  const onChange = (v: string) => {
    setValue(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      last.current = v;
      set({ q: v });
    }, 300);
  };

  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mr-muted" />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="pl-9"
      />
    </div>
  );
}

export function SelectParam({
  name,
  options,
  placeholder,
  allLabel = "All",
  className,
}: {
  name: string;
  options: readonly { value: string; label: string }[];
  placeholder: string;
  allLabel?: string;
  className?: string;
}) {
  const { get, set } = useUrlFilters();
  const value = get(name) || "all";
  return (
    <Select value={value} onValueChange={(v) => set({ [name]: v === "all" ? null : v })}>
      <SelectTrigger className={cn("w-full rounded-lg md:w-[170px]", className)} aria-label={placeholder}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{allLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function DateRangeParams() {
  const { get, set } = useUrlFilters();
  return (
    <div className="flex items-center gap-2">
      <DatePicker value={get("from") || null} onChange={(v) => set({ from: v })} placeholder="From" clearable className="w-full md:w-[170px]" />
      <DatePicker value={get("to") || null} onChange={(v) => set({ to: v })} placeholder="To" clearable className="w-full md:w-[170px]" />
    </div>
  );
}

export function ClearFilters({ keys }: { keys: string[] }) {
  const { searchParams, set } = useUrlFilters();
  const active = keys.some((k) => searchParams.get(k));
  if (!active) return null;
  return (
    <Button variant="ghost" size="sm" onClick={() => set(Object.fromEntries(keys.map((k) => [k, null])))}>
      <X /> Clear
    </Button>
  );
}
