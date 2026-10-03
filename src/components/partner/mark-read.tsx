"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markPartnerNotificationsRead } from "@/lib/actions/partner-portal";

export function PartnerMarkRead() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button type="button" variant="ghost" size="xs" disabled={pending} onClick={() => startTransition(async () => (await markPartnerNotificationsRead(), router.refresh()))}>
      {pending ? <Loader2 className="animate-spin" /> : <CheckCheck />} Mark all read
    </Button>
  );
}
