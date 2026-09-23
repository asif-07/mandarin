"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { StatusPill, INVOICE_TONES } from "@/components/shared/status-pill";
import { connectInvoiceToGroup, searchInvoicesToConnect, type InvoiceLink } from "@/lib/actions/invoices";
import { INVOICE_STATUSES, labelFor } from "@/lib/constants";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Connect an invoice that already exists to this group: for invoices raised
 * before the group was created, or filed without a group, so the group shows
 * the right billed / paid state. An invoice on another group can be moved.
 */
export function ConnectInvoiceButton({ groupId, groupRef, className }: { groupId: string; groupRef: string; className?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<InvoiceLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        setResults(await searchInvoicesToConnect(query));
      } catch {
        toast.error("Could not load invoices. Reload the page and try again.");
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query, open]);

  function connect(inv: InvoiceLink) {
    startTransition(async () => {
      const res = await connectInvoiceToGroup(inv.id, groupId);
      if (!res.ok) return void toast.error(res.error);
      toast.success(`${res.data.invoice_number} connected to ${groupRef}`);
      setOpen(false);
      setConfirmId(null);
      setQuery("");
      router.refresh();
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cn("inline-flex items-center gap-1 text-xs font-medium text-mr-body hover:text-mr-ink hover:underline", className)}>
        <Link2 className="size-3" /> Connect invoice
      </button>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (pending) return;
          setOpen(o);
          if (!o) setConfirmId(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Connect an invoice to {groupRef}</DialogTitle>
            <DialogDescription>Pick an invoice raised earlier or filed without a group. Its payments then count for this group.</DialogDescription>
          </DialogHeader>
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search invoice number or bill-to name…" autoFocus disabled={pending} />
          <ul className="max-h-[50vh] divide-y divide-mr-line overflow-y-auto rounded-md border border-mr-line">
            {loading && results.length === 0 && (
              <li className="flex items-center gap-2 px-3 py-3 text-sm text-mr-muted">
                <Loader2 className="size-4 animate-spin" /> Loading…
              </li>
            )}
            {!loading && results.length === 0 && <li className="px-3 py-3 text-sm text-mr-muted">No invoices match.</li>}
            {results.map((inv) => {
              const here = inv.travel_group_id === groupId;
              const elsewhere = !!inv.travel_group_id && !here;
              const asking = confirmId === inv.id;
              return (
                <li key={inv.id} className={cn("flex flex-wrap items-center gap-2 px-3 py-2 text-sm", here && "bg-mr-surface/60")}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-mr-ink">
                      {inv.invoice_number} <span className="font-normal text-mr-body">· {inv.bill_to_name}</span>
                    </p>
                    <p className="tnum truncate text-xs text-mr-muted">
                      {formatDate(inv.issue_date)} · {formatMoney(inv.total, inv.currency)}
                      {here ? " · already on this group" : elsewhere ? ` · on ${inv.group_ref ?? "another group"}` : " · no group"}
                    </p>
                  </div>
                  <StatusPill label={labelFor(INVOICE_STATUSES, inv.status)} tone={INVOICE_TONES[inv.status]} />
                  {here ? null : asking ? (
                    <span className="flex items-center gap-1">
                      <Button type="button" size="xs" disabled={pending} onClick={() => connect(inv)}>
                        {pending && <Loader2 className="animate-spin" />} Move here
                      </Button>
                      <Button type="button" size="xs" variant="ghost" disabled={pending} onClick={() => setConfirmId(null)}>
                        Keep
                      </Button>
                    </span>
                  ) : (
                    <Button type="button" size="xs" variant={elsewhere ? "outline" : "default"} disabled={pending} onClick={() => (elsewhere ? setConfirmId(inv.id) : connect(inv))}>
                      {pending && !elsewhere && <Loader2 className="animate-spin" />} {elsewhere ? "Move" : "Connect"}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
