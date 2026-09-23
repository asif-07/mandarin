"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { setInvoiceStatus } from "@/lib/actions/invoices";

/** One-click "Mark as paid" for an issued invoice, with a confirm. Used on group cards and the dashboard. */
export function MarkPaidButton({ invoiceId, invoiceNumber, size = "xs", variant = "outline" }: { invoiceId: string; invoiceNumber: string; size?: "xs" | "sm"; variant?: "outline" | "ghost" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <>
      <Button type="button" variant={variant} size={size} disabled={pending} onClick={() => setOpen(true)} title="Mark this invoice as paid">
        {pending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Mark as paid
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Mark ${invoiceNumber} as paid?`}
        description="The invoice shows as paid everywhere. If you also record receipts under Accounts, record the payment there instead so the ledger matches."
        confirmLabel="Mark as paid"
        pending={pending}
        onConfirm={() =>
          startTransition(async () => {
            const res = await setInvoiceStatus(invoiceId, "paid");
            setOpen(false);
            if (!res.ok) return void toast.error(res.error);
            toast.success(`${invoiceNumber} marked as paid`);
            router.refresh();
          })
        }
      />
    </>
  );
}
