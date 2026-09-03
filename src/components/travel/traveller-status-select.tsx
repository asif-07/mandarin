"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { setTravellerStatus } from "@/lib/actions/travellers";
import { TRAVELLER_STATUSES, labelFor } from "@/lib/constants";

export function TravellerStatusSelect({ travellerId, status }: { travellerId: string; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <Select
        value={status}
        disabled={pending}
        onValueChange={(v) =>
          startTransition(async () => {
            const result = await setTravellerStatus(travellerId, v);
            if (!result.ok) return void toast.error(result.error);
            toast.success(`Status set to ${labelFor(TRAVELLER_STATUSES, v)}`);
            router.refresh();
          })
        }
      >
        <SelectTrigger className="h-8 w-[190px] rounded-md" aria-label="Change status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TRAVELLER_STATUSES.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {pending && <Loader2 className="size-4 animate-spin text-mr-muted" />}
    </div>
  );
}
