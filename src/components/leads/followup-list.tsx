"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setFollowupDate, snoozeFollowup } from "@/lib/actions/leads";
import { ENQUIRY_TYPES, LEAD_STATUSES, labelFor } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export type FollowupLead = {
  id: string;
  lead_ref: string;
  full_name: string;
  phone: string;
  enquiry_type: string;
  status: string;
  next_followup_date: string | null;
  assigned_name: string | null;
};

export function FollowupItem({ lead, compact }: { lead: FollowupLead; compact?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, message: string) {
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) return void toast.error(result.error ?? "Something went wrong");
      setDone(true);
      toast.success(message);
      router.refresh();
    });
  }

  return (
    <li className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 py-3", done && "opacity-50")}>
      <div className="min-w-0 flex-1">
        <Link href={`/leads/${lead.id}`} className="block truncate text-sm font-medium text-mr-ink hover:underline">
          {lead.full_name}
        </Link>
        <p className="truncate text-xs text-mr-body">
          {lead.phone} · {ENQUIRY_TYPES.find((t) => t.value === lead.enquiry_type)?.short} · {labelFor(LEAD_STATUSES, lead.status)}
          {lead.assigned_name ? ` · ${lead.assigned_name}` : ""}
          {!compact && lead.next_followup_date ? ` · due ${formatDate(lead.next_followup_date)}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-1" aria-label="Snooze">
        {pending ? (
          <Loader2 className="size-4 animate-spin text-mr-muted" />
        ) : (
          <>
            <Button variant="outline" size="xs" onClick={() => run(() => snoozeFollowup(lead.id, 1), "Snoozed 1 day")}>
              +1d
            </Button>
            <Button variant="outline" size="xs" onClick={() => run(() => snoozeFollowup(lead.id, 3), "Snoozed 3 days")}>
              +3d
            </Button>
            <Button variant="outline" size="xs" onClick={() => run(() => snoozeFollowup(lead.id, 7), "Snoozed 1 week")}>
              +1w
            </Button>
            <Button variant="ghost" size="icon-xs" aria-label="Mark follow-up done" onClick={() => run(() => setFollowupDate(lead.id, null), "Follow-up cleared")}>
              <Check />
            </Button>
          </>
        )}
      </div>
    </li>
  );
}

export function FollowupGroup({ title, leads, tone }: { title: string; leads: FollowupLead[]; tone?: "red" | "warning" | "neutral" }) {
  return (
    <section>
      <h2 className={cn("micro-label mb-1", tone === "red" && "text-mr-red", tone === "warning" && "text-mr-warning")}>
        {title} <span className="ml-1 normal-case tracking-normal">({leads.length})</span>
      </h2>
      {leads.length === 0 ? (
        <p className="py-3 text-sm text-mr-muted">Nothing here.</p>
      ) : (
        <ul className="divide-y divide-mr-line">
          {leads.map((l) => (
            <FollowupItem key={l.id} lead={l} />
          ))}
        </ul>
      )}
    </section>
  );
}
