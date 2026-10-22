"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy, ExternalLink, Loader2, Package, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { setApplicationReviewed } from "@/lib/actions/applications";

/** Row actions on the customer applications page. */
export function ApplicationActions({ travellerId, portalStatus, token, missing }: { travellerId: string; portalStatus: string | null; token: string | null; missing: string[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const link = token && typeof window !== "undefined" ? `${window.location.origin}/apply/t/${token}` : null;

  function review(reviewed: boolean) {
    startTransition(async () => {
      const res = await setApplicationReviewed(travellerId, reviewed);
      if (!res.ok) return void toast.error(res.error);
      router.refresh();
    });
  }

  return (
    <>
      <Link href={`/travel/travellers/${travellerId}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
        <Package /> Open traveller · download documents
      </Link>
      {portalStatus === "submitted" && (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => review(true)}>
          {pending ? <Loader2 className="animate-spin" /> : <Check />} Mark reviewed
        </Button>
      )}
      {portalStatus === "reviewed" && (
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => review(false)}>
          <Undo2 /> Back to submitted
        </Button>
      )}
      {link && (
        <>
          <Button size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(link).then(() => toast.success("Customer's private link copied: send it to them to add documents")).catch(() => toast.error("Copy failed"))}>
            <Copy /> Copy their link
          </Button>
          <a href={link} target="_blank" rel="noopener" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            <ExternalLink /> Open as customer
          </a>
        </>
      )}
      {missing.length > 0 && <span className="text-xs text-mr-warning">Missing: {missing.join(", ")}</span>}
    </>
  );
}
