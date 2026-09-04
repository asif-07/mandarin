"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { removeTravellerFromGroup } from "@/lib/actions/travellers";

export function RemoveFromGroupButton({ travellerId, travellerName, groupCode }: { travellerId: string; travellerName: string; groupCode: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);

  function remove() {
    startTransition(async () => {
      const result = await removeTravellerFromGroup(travellerId);
      setConfirm(false);
      if (!result.ok) return void toast.error(result.error);
      toast.success(`${travellerName} removed from ${groupCode}`);
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="ghost" size="icon-sm" aria-label={`Remove ${travellerName} from group`} disabled={pending} onClick={() => setConfirm(true)}>
        {pending ? <Loader2 className="animate-spin" /> : <UserMinus />}
      </Button>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Remove ${travellerName} from ${groupCode}?`}
        description="The traveller and their documents are kept; only the group assignment is cleared. You can assign another group from the traveller page."
        confirmLabel="Remove from group"
        destructive
        pending={pending}
        onConfirm={remove}
      />
    </>
  );
}
