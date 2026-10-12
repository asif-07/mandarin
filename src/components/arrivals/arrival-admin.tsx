"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Copy, Link2, Loader2, MessageSquareReply, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { GroupCombobox } from "@/components/travel/group-combobox";
import { attachArrivalToGroup, replyToArrival, setArrivalStatus } from "@/lib/actions/arrivals";
import type { ArrivalRequestRow } from "@/lib/arrivals/shared";
import { formatDate } from "@/lib/format";

/** Reply with notes (shown on the agent's tracking page), confirm / close, and attach the arrival to a group. */
export function ArrivalActions({ a }: { a: ArrivalRequestRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [attach, setAttach] = useState(false);
  const [reply, setReply] = useState(a.admin_reply ?? "");
  const [pending, startTransition] = useTransition();
  const trackUrl = typeof window !== "undefined" ? `${window.location.origin}/arrivals/t/${a.token}` : `/arrivals/t/${a.token}`;

  function run(label: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error ?? "Failed");
      toast.success(label);
      setOpen(false);
      setAttach(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button type="button" size="xs" variant={a.admin_reply ? "outline" : "default"} disabled={pending} onClick={() => setOpen(true)}>
        <MessageSquareReply /> {a.admin_reply ? "Edit reply" : "Reply"}
      </Button>
      {a.status !== "confirmed" && a.status !== "closed" && (
        <Button type="button" size="xs" variant="ghost" disabled={pending} onClick={() => run("Confirmed", () => setArrivalStatus(a.id, "confirmed"))}>
          <CheckCircle2 /> Confirm
        </Button>
      )}
      {a.status !== "closed" && (
        <Button type="button" size="xs" variant="ghost" disabled={pending} onClick={() => run("Closed", () => setArrivalStatus(a.id, "closed"))}>
          <XCircle /> Close
        </Button>
      )}
      <Button type="button" size="xs" variant="ghost" disabled={pending} onClick={() => setAttach(true)} title="Attach to a group so same-day arrivals travel together">
        <Link2 /> {a.group_ref ? "Change group" : "Attach to group"}
      </Button>
      <Button type="button" size="xs" variant="ghost" onClick={() => navigator.clipboard.writeText(trackUrl).then(() => toast.success("Tracking link copied")).catch(() => toast.error("Copy failed"))} title="The agent's tracking page (shows your reply)">
        <Copy /> Tracking link
      </Button>

      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Reply · {a.ref} · {a.partner_code} · {formatDate(a.arrival_date)} {a.arrival_time}
            </DialogTitle>
            <DialogDescription>
              {a.airline_flight} · {a.pax} pax{a.agent_name ? ` · from ${a.agent_name}` : ""}
              {a.agent_phone ? ` · ${a.agent_phone}` : ""}. The agent sees this note on their tracking page.
            </DialogDescription>
          </DialogHeader>
          {a.agent_notes && <p className="rounded-md bg-mr-surface p-3 text-sm text-mr-body">Agent notes: {a.agent_notes}</p>}
          <Textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={6} placeholder="Transfer arrangement, meeting point, driver / coach details, timing…" disabled={pending} />
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="outline" disabled={pending || !reply.trim()} onClick={() => run("Reply saved", () => replyToArrival(a.id, reply, "replied"))}>
              Save reply
            </Button>
            <Button type="button" disabled={pending || !reply.trim()} onClick={() => run("Reply saved and confirmed", () => replyToArrival(a.id, reply, "confirmed"))}>
              {pending && <Loader2 className="animate-spin" />} Reply & confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={attach} onOpenChange={(o) => !pending && setAttach(o)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Attach {a.ref} to a group</DialogTitle>
            <DialogDescription>Arrivals on the same day can share one group for the airport transfer, whichever agent sent them.</DialogDescription>
          </DialogHeader>
          <GroupCombobox value={a.group_id} placeholder="Choose the group…" onChange={(g) => run(g ? `Attached to ${g.group_ref ?? g.group_code}` : "Detached from group", () => attachArrivalToGroup(a.id, g?.id ?? null))} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ArrivalsLinkButton({ className }: { className?: string }) {
  const url = typeof window !== "undefined" ? `${window.location.origin}/arrivals` : "/arrivals";
  return (
    <Button type="button" variant="outline" className={className} onClick={() => navigator.clipboard.writeText(url).then(() => toast.success("Arrival details link copied: share it with any travel agent")).catch(() => toast.error("Copy failed"))} title={url}>
      <Copy /> Copy arrival details link
    </Button>
  );
}
