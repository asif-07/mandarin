"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown, Loader2, UserSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { searchLeadsForInvoice, type LeadSearchResult } from "@/lib/actions/invoices";
import { ENQUIRY_TYPES, labelFor } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function LeadCombobox({
  value,
  onSelect,
  disabled,
}: {
  value: string | null | undefined;
  onSelect: (lead: LeadSearchResult | null) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LeadSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selected = results.find((r) => r.id === value);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        setResults(await searchLeadsForInvoice(query));
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query, open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="h-9 w-full justify-between rounded-lg font-normal"
        >
          <span className="flex items-center gap-2 truncate">
            <UserSearch className="text-mr-muted" />
            {selected ? `${selected.full_name} · ${selected.lead_ref}` : value ? "Linked lead" : "Pull from lead"}
          </span>
          <ChevronsUpDown className="text-mr-muted" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search name, phone or LD-…" value={query} onValueChange={setQuery} />
          <CommandList>
            {loading && (
              <div className="flex items-center gap-2 px-3 py-3 text-sm text-mr-muted">
                <Loader2 className="size-4 animate-spin" /> Searching…
              </div>
            )}
            {!loading && <CommandEmpty>No leads found.</CommandEmpty>}
            <CommandGroup>
              {results.map((lead) => (
                <CommandItem
                  key={lead.id}
                  value={lead.id}
                  onSelect={() => {
                    onSelect(lead);
                    setOpen(false);
                  }}
                >
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">{lead.full_name}</span>
                    <span className="truncate text-xs text-mr-muted">
                      {lead.lead_ref} · {lead.phone} · {labelFor(ENQUIRY_TYPES, lead.enquiry_type)}
                    </span>
                  </div>
                  <Check className={cn("ml-2", value === lead.id ? "opacity-100" : "opacity-0")} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
