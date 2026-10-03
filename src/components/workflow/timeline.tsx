import { formatDateTime } from "@/lib/format";
import type { GroupEvent } from "@/lib/workflow/data";
import { cn } from "@/lib/utils";

const KIND: Record<string, string> = { company: "Company", partner: "Partner", visa_team: "Visa Team", guide: "Guide", system: "System" };

/** The group's history, newest first: who did what, when, with any note. */
export function WorkflowTimeline({ events, className }: { events: GroupEvent[]; className?: string }) {
  if (events.length === 0) return <p className={cn("text-sm text-mr-muted", className)}>No workflow activity yet.</p>;
  return (
    <ol className={cn("relative space-y-3 border-l border-mr-line pl-4", className)}>
      {events.map((e) => (
        <li key={e.id} className="relative text-sm">
          <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full border-2 border-white bg-mr-ink" aria-hidden />
          <p className="font-medium text-mr-ink">{e.event}</p>
          <p className="text-xs text-mr-muted">
            {formatDateTime(e.at)} · {KIND[e.actor_kind] ?? e.actor_kind}
            {e.actor_name ? ` · ${e.actor_name}` : ""}
          </p>
          {e.note && <p className="mt-0.5 whitespace-pre-wrap text-xs text-mr-body">{e.note}</p>}
        </li>
      ))}
    </ol>
  );
}
