"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy, ExternalLink, Loader2, Package, Undo2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { createGroupWithTravellers, setApplicationReviewed } from "@/lib/actions/applications";

/** Actions on one portal application (customer or agent). */
export function ApplicationActions({ applicationId, status, token, travellerId, ungroupedIds, dates, groupLabel }: { applicationId: string; status: string; token: string | null; travellerId?: string; ungroupedIds?: string[]; dates?: { travel_date: string; travel_end_date: string }; groupLabel?: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const link = token && typeof window !== "undefined" ? `${window.location.origin}/apply/t/${token}` : null;

  function review(reviewed: boolean) {
    startTransition(async () => {
      const res = await setApplicationReviewed(applicationId, reviewed);
      if (!res.ok) return void toast.error(res.error);
      router.refresh();
    });
  }

  function makeGroup() {
    if (!ungroupedIds?.length || !dates) return;
    startTransition(async () => {
      const res = await createGroupWithTravellers(ungroupedIds, dates, groupLabel ?? null);
      if (!res.ok) return void toast.error(res.error);
      toast.success(`Group ${res.data.group_code} created with ${res.data.assigned} traveller${res.data.assigned === 1 ? "" : "s"}`);
      router.refresh();
    });
  }

  return (
    <>
      {travellerId && (
        <Link href={`/travel/travellers/${travellerId}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
          <Package /> Open traveller · download documents
        </Link>
      )}
      {ungroupedIds && ungroupedIds.length >= 2 && dates && (
        <Button size="sm" disabled={pending} onClick={makeGroup}>
          {pending ? <Loader2 className="animate-spin" /> : <Users />} Create group of {ungroupedIds.length}
        </Button>
      )}
      {status === "submitted" && (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => review(true)}>
          {pending ? <Loader2 className="animate-spin" /> : <Check />} Mark reviewed
        </Button>
      )}
      {status === "reviewed" && (
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => review(false)}>
          <Undo2 /> Back to submitted
        </Button>
      )}
      {link && (
        <>
          <Button size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(link).then(() => toast.success("Private link copied: send it to them to add documents")).catch(() => toast.error("Copy failed"))}>
            <Copy /> Copy their link
          </Button>
          <a href={link} target="_blank" rel="noopener" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            <ExternalLink /> Open as uploader
          </a>
        </>
      )}
    </>
  );
}
