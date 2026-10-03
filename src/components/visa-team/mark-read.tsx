"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markVisaTeamNotificationsRead } from "@/lib/actions/visa-team";

export function VisaMarkRead() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button type="button" variant="ghost" size="xs" disabled={pending} onClick={() => startTransition(async () => (await markVisaTeamNotificationsRead(), router.refresh()))}>
      {pending ? <Loader2 className="animate-spin" /> : <CheckCheck />} Mark all read
    </Button>
  );
}
