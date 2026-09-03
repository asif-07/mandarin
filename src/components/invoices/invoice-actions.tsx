"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2, Copy, Download, Eye, MoreHorizontal, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { duplicateInvoice, setInvoiceStatus } from "@/lib/actions/invoices";

type InvoiceLite = { id: string; invoice_number: string; status: string };

export function InvoiceActionsMenu({ invoice, showView = true }: { invoice: InvoiceLite; showView?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<"paid" | "cancelled" | null>(null);

  function changeStatus(status: "paid" | "cancelled") {
    startTransition(async () => {
      const result = await setInvoiceStatus(invoice.id, status);
      setConfirm(null);
      if (!result.ok) return void toast.error(result.error);
      toast.success(status === "paid" ? `${invoice.invoice_number} marked as paid` : `${invoice.invoice_number} cancelled`);
      router.refresh();
    });
  }

  function duplicate() {
    startTransition(async () => {
      const result = await duplicateInvoice(invoice.id);
      if (!result.ok) return void toast.error(result.error);
      toast.success(`Duplicated as ${result.data.invoice_number}`);
      router.push(`/invoices/${result.data.id}/edit`);
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${invoice.invoice_number}`} disabled={pending}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {showView && (
            <DropdownMenuItem asChild>
              <Link href={`/invoices/${invoice.id}`}>
                <Eye /> View
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild>
            <Link href={`/invoices/${invoice.id}/edit`}>
              <Pencil /> Edit
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href={`/api/invoices/${invoice.id}/pdf`}>
              <Download /> Download PDF
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={duplicate}>
            <Copy /> Duplicate
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={invoice.status === "paid" || invoice.status === "cancelled"} onSelect={() => setConfirm("paid")}>
            <CheckCircle2 /> Mark paid
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={invoice.status === "cancelled"}
            onSelect={() => setConfirm("cancelled")}
            className="text-mr-red focus:text-mr-red"
          >
            <Ban /> Cancel invoice
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirm === "paid"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Mark ${invoice.invoice_number} as paid?`}
        description="The invoice will show as paid in lists and on the dashboard."
        confirmLabel="Mark paid"
        pending={pending}
        onConfirm={() => changeStatus("paid")}
      />
      <ConfirmDialog
        open={confirm === "cancelled"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Cancel ${invoice.invoice_number}?`}
        description="Cancelled invoices are kept so the number sequence has no gaps. This cannot be undone from the UI."
        confirmLabel="Cancel invoice"
        destructive
        pending={pending}
        onConfirm={() => changeStatus("cancelled")}
      />
    </>
  );
}
