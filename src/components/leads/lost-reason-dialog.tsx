"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { LOST_REASONS } from "@/lib/constants";

export function LostReasonDialog({
  open,
  leadName,
  pending,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  leadName?: string;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string, note: string) => void;
}) {
  const [reason, setReason] = useState<string>("");
  const [note, setNote] = useState("");

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mark as lost</DialogTitle>
          <DialogDescription>{leadName ? `Why was ${leadName} lost?` : "Why was this lead lost?"}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="lost_reason">Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger id="lost_reason" className="w-full rounded-lg">
                <SelectValue placeholder="Choose a reason" />
              </SelectTrigger>
              <SelectContent>
                {LOST_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lost_note">Note (optional)</Label>
            <Textarea id="lost_note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={!reason || pending} onClick={() => onConfirm(reason, note)}>
            {pending && <Loader2 className="animate-spin" />} Mark lost
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
