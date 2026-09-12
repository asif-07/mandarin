"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HOTEL_STARS } from "@/lib/constants";

/** 3 / 4 / 5 star picker for packages with a hotel class. */
export function HotelStarsSelect({ id, value, onChange, invalid }: { id?: string; value: number | string | null | undefined; onChange: (v: number | null) => void; invalid?: boolean }) {
  return (
    <Select value={value ? String(value) : ""} onValueChange={(v) => onChange(v ? Number(v) : null)}>
      <SelectTrigger id={id} className="w-full rounded-lg" aria-invalid={invalid}>
        <SelectValue placeholder="Choose hotel class" />
      </SelectTrigger>
      <SelectContent>
        {HOTEL_STARS.map((s) => (
          <SelectItem key={s} value={String(s)}>
            {s} star
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
