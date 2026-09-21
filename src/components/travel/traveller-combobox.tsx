"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronsUpDown, Loader2, UserSearch, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { searchTravellersForGroup, type TravellerPick } from "@/lib/actions/travellers";
import { cn } from "@/lib/utils";

/**
 * Pick existing travellers (multi-select) to pull into a group. Loads from
 * the server on open and on each keystroke; unassigned travellers come first.
 */
export function TravellerCombobox({ selected, onChange, excludeGroupId, id }: { selected: TravellerPick[]; onChange: (next: TravellerPick[]) => void; excludeGroupId?: string | null; id?: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TravellerPick[]>([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        setResults(await searchTravellersForGroup(query));
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query, open]);

  const chosen = new Set(selected.map((t) => t.id));
  const options = results.filter((t) => !(excludeGroupId && t.travel_group_id === excludeGroupId));

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button id={id} type="button" variant="outline" role="combobox" aria-expanded={open} className="h-9 w-full justify-between rounded-lg font-normal text-mr-muted">
            <span className="flex items-center gap-2 truncate">
              <UserSearch className="size-4" /> Add an existing traveller…
            </span>
            <ChevronsUpDown className="text-mr-muted" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[340px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder="Search name, TR number, passport or phone…" value={query} onValueChange={setQuery} />
            <CommandList className="max-h-[320px]">
              {loading && (
                <div className="flex items-center gap-2 px-3 py-3 text-sm text-mr-muted">
                  <Loader2 className="size-4 animate-spin" /> Loading…
                </div>
              )}
              {!loading && <CommandEmpty>No travellers found.</CommandEmpty>}
              <CommandGroup heading="Travellers (not in a group first)">
                {options.map((t) => (
                  <CommandItem
                    key={t.id}
                    value={t.id}
                    disabled={chosen.has(t.id)}
                    onSelect={() => {
                      if (!chosen.has(t.id)) onChange([...selected, t]);
                      setOpen(false);
                      setQuery("");
                    }}
                    className={cn(chosen.has(t.id) && "opacity-50")}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-medium text-mr-ink">{t.full_name}</span>
                      <span className="ml-2 font-mono text-xs text-mr-muted">{t.traveller_ref}</span>
                      {t.passport_number && <span className="ml-2 text-xs text-mr-body">{t.passport_number}</span>}
                    </span>
                    <span className={cn("ml-2 shrink-0 text-xs", t.travel_group_id ? "text-mr-warning" : "text-mr-success")}>{t.travel_group_id ? `in ${t.group_ref ?? "a group"}` : "not in a group"}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {selected.map((t) => (
            <li key={t.id} className="inline-flex items-center gap-1 rounded-md border border-mr-line bg-mr-surface px-2 py-1 text-xs text-mr-ink">
              {t.full_name} <span className="font-mono text-mr-muted">{t.traveller_ref}</span>
              {t.travel_group_id && <span className="text-mr-warning">(moves from {t.group_ref ?? "another group"})</span>}
              <button type="button" aria-label={`Remove ${t.full_name}`} className="ml-1 text-mr-muted hover:text-mr-ink" onClick={() => onChange(selected.filter((x) => x.id !== t.id))}>
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
