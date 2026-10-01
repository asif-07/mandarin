"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, FileCheck2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { cancelTransferVoucher, ticketDownloadUrl } from "@/lib/actions/transfer-vouchers";

export function TicketLink({ voucherId, fileName }: { voucherId: string; fileName: string | null }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      disabled={pending}
      title={fileName ?? "Ticket"}
      onClick={() =>
        startTransition(async () => {
          const res = await ticketDownloadUrl(voucherId);
          if (!res.ok) return void toast.error(res.error);
          window.open(res.data.url, "_blank", "noopener");
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <FileCheck2 />} Ticket
    </Button>
  );
}

export function CancelVoucherButton({ voucherId, voucherNo }: { voucherId: string; voucherNo: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <>
      <Button type="button" variant="ghost" size="icon-xs" aria-label={`Cancel ${voucherNo}`} title="Cancel voucher" disabled={pending} onClick={() => setOpen(true)}>
        <Ban />
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Cancel ${voucherNo}?`}
        description="Its QR code will no longer verify at the meeting point. Issue a new voucher if the transfer still goes ahead."
        confirmLabel="Cancel voucher"
        destructive
        pending={pending}
        onConfirm={() =>
          startTransition(async () => {
            const res = await cancelTransferVoucher(voucherId);
            setOpen(false);
            if (!res.ok) return void toast.error(res.error);
            toast.success(`${voucherNo} cancelled`);
            router.refresh();
          })
        }
      />
    </>
  );
}
