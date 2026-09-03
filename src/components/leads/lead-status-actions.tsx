"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, FileText, Loader2, Plane, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { LostReasonDialog } from "@/components/leads/lost-reason-dialog";
import { changeLeadStatus } from "@/lib/actions/leads";
import { LEAD_STATUSES, labelFor, type LeadStatus } from "@/lib/constants";

export function LeadStatusActions({ lead }: { lead: { id: string; full_name: string; status: string } }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<"won" | "lost" | null>(null);

  function change(status: LeadStatus, lostReason?: string, note?: string, then?: () => void) {
    startTransition(async () => {
      const result = await changeLeadStatus(lead.id, { status, lost_reason: lostReason ?? null, note: note || null });
      setDialog(null);
      if (!result.ok) return void toast.error(result.error);
      toast.success(`Marked as ${labelFor(LEAD_STATUSES, status)}`);
      if (then) then();
      else router.refresh();
    });
  }

  const isWon = lead.status === "won";

  return (
    <>
      <Link href={`/invoices/new?lead=${lead.id}`} className={buttonVariants({ variant: "outline" })}>
        <FileText /> Create invoice
      </Link>
      {isWon ? (
        <Link href={`/travel/travellers/new?lead=${lead.id}`} className={buttonVariants()}>
          <Plane /> Add to travel
        </Link>
      ) : (
        <Button onClick={() => setDialog("won")} disabled={pending}>
          <Plane /> Mark won → Add to travel
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" disabled={pending} aria-label="More status actions">
            {pending ? <Loader2 className="animate-spin" /> : <ChevronDown />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>Set status</DropdownMenuLabel>
          {LEAD_STATUSES.filter((s) => s.value !== "won" && s.value !== "lost").map((s) => (
            <DropdownMenuItem key={s.value} disabled={lead.status === s.value} onSelect={() => change(s.value)}>
              {s.label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={lead.status === "lost"} onSelect={() => setDialog("lost")} className="text-mr-red focus:text-mr-red">
            <XCircle /> Mark lost
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={dialog === "won"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Mark ${lead.full_name} as won?`}
        description="The lead moves to Won and you will be taken to the traveller form, prefilled from this lead."
        confirmLabel="Mark won and continue"
        pending={pending}
        onConfirm={() => change("won", undefined, undefined, () => router.push(`/travel/travellers/new?lead=${lead.id}`))}
      />
      <LostReasonDialog
        open={dialog === "lost"}
        leadName={lead.full_name}
        pending={pending}
        onCancel={() => setDialog(null)}
        onConfirm={(reason, note) => change("lost", reason, note)}
      />
    </>
  );
}
