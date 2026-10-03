"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileCheck2, Loader2, Mail, Send, Share2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { WorkflowStatusChip } from "@/components/workflow/status-chip";
import { approveVisa, companyDecision, markGroupCompleted, resendVisaEmail, sendToVisaTeam, setStampedVisaShared } from "@/lib/actions/workflow";
import { STANDARD_BORDER } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/format";

export type WorkflowPanelGroup = {
  id: string;
  workflow_status: string | null;
  submitted_by_partner: boolean;
  submitted_at: string | null;
  other_border_requested: boolean;
  other_border_note: string | null;
  company_decision_note: string | null;
  arrival_flight_date: string | null;
  arrival_flight_time: string | null;
  departure_flight_date: string | null;
  departure_flight_time: string | null;
  visa_path: string | null;
  visa_approved_at: string | null;
  visa_emailed_at: string | null;
  guide_name: string | null;
  guide_phone: string | null;
  destination: string | null;
  vehicle_notes: string | null;
  stamped_visa_path: string | null;
  stamped_visa_uploaded_at: string | null;
  stamped_visa_shared: boolean;
  china_entry_at: string | null;
  china_entry_confirmed_by: string | null;
  china_exit_at: string | null;
  china_exit_confirmed_by: string | null;
};

/**
 * The company's view of a group's workflow on the group card: status, the
 * partner's flight details, ground operations, and the actions the company
 * takes (approve / correct / reject a submission, forward a manual group to
 * the Visa Team, approve the uploaded visa, share the stamped copy, complete).
 */
export function GroupWorkflowPanel({ g }: { g: WorkflowPanelGroup }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [decide, setDecide] = useState<"correction" | "reject" | null>(null);
  const [note, setNote] = useState("");
  const s = g.workflow_status;

  function run(label: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error ?? "Failed");
      toast.success(label);
      setDecide(null);
      setNote("");
      router.refresh();
    });
  }

  const flights =
    g.arrival_flight_date || g.departure_flight_date
      ? `Arrives HK ${g.arrival_flight_date ? formatDate(g.arrival_flight_date) : "—"} ${(g.arrival_flight_time ?? "").slice(0, 5)} · Departs ${g.departure_flight_date ? formatDate(g.departure_flight_date) : "—"} ${(g.departure_flight_time ?? "").slice(0, 5)}`
      : null;

  return (
    <div className="rounded-md border border-mr-line bg-mr-surface/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="micro-label">Workflow</p>
        <Link href={`/travel/workflow?group=${g.id}`} className="text-xs font-medium text-mr-body hover:text-mr-ink hover:underline">
          Timeline & details
        </Link>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <WorkflowStatusChip status={s} />
        {g.submitted_by_partner && <span className="text-xs text-mr-muted">submitted by partner{g.submitted_at ? ` ${formatDateTime(g.submitted_at)}` : ""}</span>}
        {g.other_border_requested && <span className="rounded-md bg-mr-warning/10 px-1.5 py-0.5 text-[11px] font-medium text-mr-warning">Other border requested{g.other_border_note ? ` · ${g.other_border_note}` : ""} (normal: {STANDARD_BORDER})</span>}
      </div>
      {flights && <p className="mt-1 text-xs text-mr-body">{flights}</p>}
      {(g.guide_name || g.destination || g.china_entry_at || g.china_exit_at) && (
        <p className="mt-1 text-xs text-mr-body">
          {g.guide_name ? `Guide ${g.guide_name}${g.guide_phone ? ` · ${g.guide_phone}` : ""}` : "No guide assigned"}
          {g.destination ? ` · to ${g.destination}` : ""}
          {g.china_entry_at ? ` · entered China ${formatDateTime(g.china_entry_at)}${g.china_entry_confirmed_by ? ` (${g.china_entry_confirmed_by})` : ""}` : ""}
          {g.china_exit_at ? ` · exited ${formatDateTime(g.china_exit_at)}${g.china_exit_confirmed_by ? ` (${g.china_exit_confirmed_by})` : ""}` : ""}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {(s === "submitted" || s === "correction_requested") && (
          <>
            <Button type="button" size="xs" disabled={pending} onClick={() => run("Group approved and forwarded to the Visa Team", () => companyDecision(g.id, "approve"))}>
              <CheckCircle2 /> Approve
            </Button>
            <Button type="button" size="xs" variant="outline" disabled={pending} onClick={() => setDecide("correction")}>
              Request correction
            </Button>
            <Button type="button" size="xs" variant="ghost" className="text-mr-red" disabled={pending} onClick={() => setDecide("reject")}>
              <XCircle /> Reject
            </Button>
          </>
        )}
        {(s === null || s === "draft" || s === "rejected") && (
          <Button type="button" size="xs" variant="outline" disabled={pending} onClick={() => run("Sent to the China Visa Team", () => sendToVisaTeam(g.id))} title="Approve this group yourself and put it in the Visa Team queue">
            <Send /> Send to Visa Team
          </Button>
        )}
        {s === "visa_issued" && g.visa_path && (
          <>
            <a href={`/api/groups/${g.id}/visa`} className={buttonVariants({ variant: "outline", size: "xs" })}>
              <FileCheck2 /> Review uploaded visa
            </a>
            <Button type="button" size="xs" disabled={pending} onClick={() => run("Visa approved; partner notified", () => approveVisa(g.id))}>
              <CheckCircle2 /> Approve visa
            </Button>
          </>
        )}
        {g.visa_approved_at && (
          <Button type="button" size="xs" variant="ghost" disabled={pending} title={g.visa_emailed_at ? `Emailed ${formatDateTime(g.visa_emailed_at)}` : "Not emailed yet"} onClick={() => run("Email sent", () => resendVisaEmail(g.id).then((r) => (r.ok && r.data.email !== "sent" ? { ok: false, error: `Email ${r.data.email}${r.data.error ? `: ${r.data.error}` : ""}` } : r)))}>
            <Mail /> {g.visa_emailed_at ? "Re-send visa email" : "Email visa to partner"}
          </Button>
        )}
        {g.stamped_visa_path && (
          <>
            <a href={`/api/groups/${g.id}/stamped-visa`} className={buttonVariants({ variant: "outline", size: "xs" })}>
              <FileCheck2 /> Stamped visa copy
            </a>
            <Button type="button" size="xs" variant="ghost" disabled={pending} onClick={() => run(g.stamped_visa_shared ? "Hidden from the partner" : "Shared with the partner", () => setStampedVisaShared(g.id, !g.stamped_visa_shared))}>
              <Share2 /> {g.stamped_visa_shared ? "Shared with partner" : "Share with partner"}
            </Button>
          </>
        )}
        {s === "china_exited" && (
          <Button type="button" size="xs" variant="outline" disabled={pending} onClick={() => run("Group completed", () => markGroupCompleted(g.id))}>
            <CheckCircle2 /> Mark group completed
          </Button>
        )}
        {pending && <Loader2 className="size-4 animate-spin text-mr-muted" />}
      </div>

      <Dialog open={!!decide} onOpenChange={(o) => !o && !pending && setDecide(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{decide === "reject" ? "Reject this submission?" : "Request a correction"}</DialogTitle>
            <DialogDescription>{decide === "reject" ? "The partner is notified with your reason. They can submit a new group." : "The partner is notified, fixes the group in their portal and submits it again."}</DialogDescription>
          </DialogHeader>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={decide === "reject" ? "Reason" : "What needs to change"} rows={4} disabled={pending} />
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setDecide(null)}>
              Cancel
            </Button>
            <Button type="button" variant={decide === "reject" ? "destructive" : "default"} disabled={pending || !note.trim()} onClick={() => run(decide === "reject" ? "Submission rejected" : "Correction requested", () => companyDecision(g.id, decide!, note))}>
              {pending && <Loader2 className="animate-spin" />} {decide === "reject" ? "Reject" : "Send request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
