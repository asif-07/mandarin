"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TRANSIT_LOCATIONS } from "@/lib/constants";

/** Optional transit location for packages with a transit leg. */
export function TransitSelect({ id, value, onChange }: { id?: string; value: string | null | undefined; onChange: (v: string | null) => void }) {
  return (
    <Select value={value ?? "none"} onValueChange={(v) => onChange(v === "none" ? null : v)}>
      <SelectTrigger id={id} className="w-full rounded-lg">
        <SelectValue placeholder="Not decided yet" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Not decided yet</SelectItem>
        {TRANSIT_LOCATIONS.map((t) => (
          <SelectItem key={t} value={t}>
            {t}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
