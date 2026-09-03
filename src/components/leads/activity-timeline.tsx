"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Loader2, Mail, MessageCircle, Phone, StickyNote, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addLeadActivity } from "@/lib/actions/leads";
import { ACTIVITY_TYPES, LEAD_STATUSES, labelFor } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";

export type ActivityRow = {
  id: string;
  activity_type: string;
  body: string | null;
  old_status: string | null;
  new_status: string | null;
  created_at: string | null;
  author_name: string | null;
};

const ICONS: Record<string, typeof StickyNote> = {
  note: StickyNote,
  call: Phone,
  whatsapp: MessageCircle,
  email: Mail,
  meeting: Users,
  status_change: ArrowRightLeft,
};

export function AddActivity({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState("note");
  const [body, setBody] = useState("");

  function submit() {
    if (!body.trim()) return void toast.error("Write something first");
    startTransition(async () => {
      const result = await addLeadActivity(leadId, { activity_type: type, body });
      if (!result.ok) return void toast.error(result.error);
      setBody("");
      toast.success("Added to timeline");
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-mr-line p-3">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Add a note, call summary or WhatsApp log…"
        rows={2}
        disabled={pending}
        aria-label="New activity"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
        }}
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <Select value={type} onValueChange={setType} disabled={pending}>
          <SelectTrigger className="h-8 w-[130px] rounded-md" aria-label="Activity type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACTIVITY_TYPES.filter((a) => a.value !== "status_change").map((a) => (
              <SelectItem key={a.value} value={a.value}>
                {a.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={submit} disabled={pending || !body.trim()}>
          {pending && <Loader2 className="animate-spin" />} Add
        </Button>
      </div>
    </div>
  );
}

export function ActivityTimeline({ activities }: { activities: ActivityRow[] }) {
  if (activities.length === 0) {
    return <p className="py-6 text-center text-sm text-mr-muted">No activity yet.</p>;
  }
  return (
    <ol className="relative space-y-4 border-l border-mr-line pl-5">
      {activities.map((a) => {
        const Icon = ICONS[a.activity_type] ?? StickyNote;
        return (
          <li key={a.id} className="relative">
            <span className="absolute -left-[29px] top-0.5 flex size-4 items-center justify-center rounded-full border border-mr-line bg-white">
              <Icon className="size-2.5 text-mr-body" />
            </span>
            <div className="flex flex-wrap items-baseline justify-between gap-x-2">
              <span className="text-xs font-medium text-mr-ink">
                {a.activity_type === "status_change" && a.old_status && a.new_status
                  ? `${labelFor(LEAD_STATUSES, a.old_status)} → ${labelFor(LEAD_STATUSES, a.new_status)}`
                  : labelFor(ACTIVITY_TYPES, a.activity_type)}
              </span>
              <span className="text-xs text-mr-muted">
                {a.author_name ? `${a.author_name} · ` : ""}
                {formatDateTime(a.created_at)}
              </span>
            </div>
            {a.body && <p className="mt-1 whitespace-pre-wrap text-sm text-mr-body">{a.body}</p>}
          </li>
        );
      })}
    </ol>
  );
}
