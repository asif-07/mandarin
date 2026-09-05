"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * Generic server-searched picker: opens, loads `search("")`, then reloads on
 * each debounced keystroke. Used for invoices and deals inside accounts dialogs.
 */
export function RecordCombobox<T extends { id: string }>({
  value,
  onChange,
  search,
  renderOption,
  renderValue,
  placeholder = "Search",
  emptyText = "No matches",
  disabled,
  allowClear = true,
  id,
}: {
  value: T | null;
  onChange: (item: T | null) => void;
  search: (query: string) => Promise<T[]>;
  renderOption: (item: T) => React.ReactNode;
  renderValue: (item: T) => React.ReactNode;
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  allowClear?: boolean;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        setResults(await search(query));
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query, open, search]);

  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn("h-9 w-full justify-between rounded-lg font-normal", !value && "text-mr-muted")}
          >
            <span className="min-w-0 flex-1 truncate text-left">{value ? renderValue(value) : placeholder}</span>
            <ChevronsUpDown className="size-4 shrink-0 text-mr-muted" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[320px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder={placeholder} value={query} onValueChange={setQuery} />
            <CommandList>
              {loading && (
                <div className="flex items-center justify-center py-4 text-mr-muted">
                  <Loader2 className="size-4 animate-spin" />
                </div>
              )}
              {!loading && results.length === 0 && <CommandEmpty>{emptyText}</CommandEmpty>}
              {!loading && results.length > 0 && (
                <CommandGroup>
                  {results.map((item) => (
                    <CommandItem
                      key={item.id}
                      value={item.id}
                      onSelect={() => {
                        onChange(item);
                        setOpen(false);
                        setQuery("");
                      }}
                    >
                      <span className="min-w-0 flex-1">{renderOption(item)}</span>
                      {value?.id === item.id && <Check className="size-4" />}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {allowClear && value && !disabled && (
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Clear" onClick={() => onChange(null)}>
          <X />
        </Button>
      )}
    </div>
  );
}
