"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogIn, LogOut, Loader2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { markGroupEntered, markGroupExitedManually, undoGroupMovement } from "@/lib/actions/workflow";

/** Mark a group as entered / exited China by hand, with an optional time, and undo. */
export function MovementActions({ groupId, groupRef, entered, exited }: { groupId: string; groupRef: string; entered: boolean; exited: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [ask, setAsk] = useState<"entry" | "exit" | null>(null);
  const [when, setWhen] = useState("");

  function run(label: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error ?? "Failed");
      toast.success(label);
      setAsk(null);
      setWhen("");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {!entered && !exited && (
        <Button type="button" size="xs" disabled={pending} onClick={() => setAsk("entry")}>
          <LogIn /> Mark entered
        </Button>
      )}
      {entered && !exited && (
        <>
          <Button type="button" size="xs" disabled={pending} onClick={() => setAsk("exit")}>
            <LogOut /> Mark exited
          </Button>
          <Button type="button" size="xs" variant="ghost" disabled={pending} onClick={() => run("Entry undone", () => undoGroupMovement(groupId, "entry"))} title="Undo the entry confirmation">
            <Undo2 /> Undo entry
          </Button>
        </>
      )}
      {!entered && exited === false ? null : null}
      {exited && (
        <Button type="button" size="xs" variant="ghost" disabled={pending} onClick={() => run("Exit undone", () => undoGroupMovement(groupId, "exit"))} title="Undo the exit confirmation">
          <Undo2 /> Undo exit
        </Button>
      )}
      {!entered && exited && null}
      {pending && <Loader2 className="size-4 animate-spin text-mr-muted" />}

      <Dialog open={!!ask} onOpenChange={(o) => !pending && !o && setAsk(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{ask === "entry" ? "Mark as entered China" : "Mark as exited China"}</DialogTitle>
            <DialogDescription>
              {groupRef}. {ask === "entry" ? "Status becomes TRAVELLING IN CHINA." : "Status becomes CHINA EXITED and the travellers become Travelled."} Leave the time empty for now.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor={`mv-when-${groupId}`}>Time (optional)</Label>
            <Input id={`mv-when-${groupId}`} type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} disabled={pending} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setAsk(null)}>
              Cancel
            </Button>
            <Button type="button" disabled={pending} onClick={() => run(ask === "entry" ? "Marked as entered China" : "Marked as exited China", () => (ask === "entry" ? markGroupEntered(groupId, when || null) : markGroupExitedManually(groupId, when || null)))}>
              {pending && <Loader2 className="animate-spin" />} {ask === "entry" ? "Confirm entry" : "Confirm exit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
