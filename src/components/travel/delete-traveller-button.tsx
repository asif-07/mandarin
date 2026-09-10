"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { deleteTraveller } from "@/lib/actions/travellers";

export function DeleteTravellerButton({ travellerId, travellerName, variant = "outline", iconOnly = false }: { travellerId: string; travellerName: string; variant?: "outline" | "ghost"; iconOnly?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);

  function remove() {
    startTransition(async () => {
      const res = await deleteTraveller(travellerId);
      setConfirm(false);
      if (!res.ok) return void toast.error(res.error);
      toast.success(`${travellerName} deleted`);
      router.push(res.data.groupDate ? `/travel?date=${res.data.groupDate}` : "/travel/travellers");
      router.refresh();
    });
  }

  return (
    <>
      <Button variant={variant} size={iconOnly ? "icon-sm" : "default"} className={iconOnly ? "" : "text-mr-red hover:text-mr-red"} aria-label={`Delete ${travellerName}`} disabled={pending} onClick={() => setConfirm(true)}>
        {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
        {!iconOnly && "Delete traveller"}
      </Button>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Delete ${travellerName}?`}
        description="The traveller record, their document list and pack history are removed. Uploaded files stay in storage for the audit trail. This cannot be undone."
        confirmLabel="Delete traveller"
        destructive
        pending={pending}
        onConfirm={remove}
      />
    </>
  );
}
