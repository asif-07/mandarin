"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { searchGroups, type GroupOption } from "@/lib/actions/travel-groups";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export function groupOptionLabel(g: GroupOption) {
  const parts = [formatDate(g.travel_date), g.group_code];
  if (g.label) parts.push(g.label);
  return `${parts.join(" · ")} (${g.traveller_count} traveller${g.traveller_count === 1 ? "" : "s"})`;
}

/**
 * Searchable, date-grouped travel group picker. Loads from the server on
 * open and on each (debounced) keystroke so it scales to hundreds of groups.
 */
export function GroupCombobox({
  value,
  initial,
  onChange,
  disabled,
  id,
  allowClear = true,
}: {
  value: string | null | undefined;
  /** The currently selected group, so the trigger can show a label before any search. */
  initial?: GroupOption | null;
  onChange: (group: GroupOption | null) => void;
  disabled?: boolean;
  id?: string;
  allowClear?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GroupOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<GroupOption | null>(initial ?? null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!value) setSelected(null);
  }, [value]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        setResults(await searchGroups(query));
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query, open]);

  const grouped = useMemo(() => {
    const map = new Map<string, GroupOption[]>();
    results.forEach((g) => {
      const list = map.get(g.travel_date) ?? [];
      list.push(g);
      map.set(g.travel_date, list);
    });
    return [...map.entries()];
  }, [results]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("h-9 w-full justify-between rounded-lg font-normal", !selected && "text-mr-muted")}
        >
          <span className="truncate">{selected ? groupOptionLabel(selected) : "Choose a travel group"}</span>
          <ChevronsUpDown className="text-mr-muted" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[320px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search date (2026-10), code (G03) or label…" value={query} onValueChange={setQuery} />
          <CommandList className="max-h-[320px]">
            {loading && (
              <div className="flex items-center gap-2 px-3 py-3 text-sm text-mr-muted">
                <Loader2 className="size-4 animate-spin" /> Loading…
              </div>
            )}
            {!loading && <CommandEmpty>No groups found.</CommandEmpty>}
            {allowClear && selected && (
              <CommandGroup>
                <CommandItem
                  value="__clear"
                  onSelect={() => {
                    setSelected(null);
                    onChange(null);
                    setOpen(false);
                  }}
                >
                  No group
                </CommandItem>
              </CommandGroup>
            )}
            {grouped.map(([date, groups]) => (
              <CommandGroup key={date} heading={formatDate(date)}>
                {groups.map((g) => (
                  <CommandItem
                    key={g.id}
                    value={g.id}
                    onSelect={() => {
                      setSelected(g);
                      onChange(g);
                      setOpen(false);
                    }}
                  >
                    <span className="font-medium">{g.group_code}</span>
                    {g.label && <span className="truncate text-mr-body">· {g.label}</span>}
                    <span className="ml-auto inline-flex items-center gap-1 text-xs text-mr-muted">
                      <Users className="size-3" /> {g.traveller_count}
                    </span>
                    <Check className={cn("ml-1", value === g.id ? "opacity-100" : "opacity-0")} />
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
