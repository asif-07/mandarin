"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lightbulb, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createGroupWithTravellers, joinSuggestedGroup } from "@/lib/actions/applications";
import { MIN_GROUP_PAX, type Suggestion } from "@/lib/travel/suggestions";
import { cn } from "@/lib/utils";

/** Merge / pair-up suggestions for one ungrouped traveller, with one-click actions. */
export function GroupSuggestions({ travellerId, suggestions, compact = false }: { travellerId: string; suggestions: Suggestion[]; compact?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  function join(groupId: string, label: string) {
    setBusyKey(groupId);
    startTransition(async () => {
      const res = await joinSuggestedGroup(travellerId, groupId);
      setBusyKey(null);
      if (!res.ok) return void toast.error(res.error);
      toast.success(`Added to ${label}: the traveller now has the group's dates`);
      router.refresh();
    });
  }

  function pair(ids: string[], dates: { travel_date: string; travel_end_date: string }) {
    setBusyKey("pair");
    startTransition(async () => {
      const res = await createGroupWithTravellers(ids, dates);
      setBusyKey(null);
      if (!res.ok) return void toast.error(res.error);
      toast.success(`Group ${res.data.group_code} created with ${res.data.assigned} traveller${res.data.assigned === 1 ? "" : "s"}`);
      router.refresh();
    });
  }

  if (suggestions.length === 0) {
    return <p className={cn("text-xs text-mr-muted", compact ? "" : "rounded-md border border-dashed border-mr-line px-3 py-2")}>No group on similar dates yet. The group visa needs at least {MIN_GROUP_PAX} travellers: watch for another applicant within 3 days.</p>;
  }
  return (
    <ul className={cn("space-y-1.5", !compact && "rounded-md border border-mr-ink/30 bg-mr-surface p-2")}>
      {suggestions.map((s, i) => {
        const key = s.kind === "group" ? s.group.id : "pair";
        return (
          <li key={`${key}-${i}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            {s.kind === "group" ? <Lightbulb className="size-3.5 shrink-0 text-mr-warning" /> : <Users className="size-3.5 shrink-0 text-mr-ink" />}
            <span className="min-w-0 flex-1 text-mr-body">
              {s.kind === "group" ? "Merge into " : ""}
              {s.reason}
            </span>
            {s.kind === "group" ? (
              <Button size="xs" variant="outline" disabled={pending} onClick={() => join(s.group.id, s.group.group_ref ?? "the group")}>
                {busyKey === s.group.id ? <Loader2 className="animate-spin" /> : null} Add to group
              </Button>
            ) : (
              <Button size="xs" variant="outline" disabled={pending} onClick={() => pair(s.travellers.map((t) => t.id), { travel_date: s.travel_date, travel_end_date: s.travel_end_date })}>
                {busyKey === "pair" ? <Loader2 className="animate-spin" /> : null} Create group of {s.travellers.length}
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
