"use client";

import { useState } from "react";
import { CalendarIcon, X } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  disabled,
  clearable,
  id,
  className,
}: {
  value: string | null | undefined; // yyyy-MM-dd
  onChange: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  clearable?: boolean;
  id?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? parseISO(value) : undefined;
  const valid = selected && isValid(selected) ? selected : undefined;

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn("h-9 w-full justify-start rounded-lg font-normal", !valid && "text-mr-muted")}
          >
            <CalendarIcon className="text-mr-muted" />
            {valid ? formatDate(value) : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={valid}
            defaultMonth={valid}
            onSelect={(d) => {
              onChange(d ? format(d, "yyyy-MM-dd") : null);
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
      {clearable && valid && !disabled && (
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Clear date" onClick={() => onChange(null)}>
          <X />
        </Button>
      )}
    </div>
  );
}
