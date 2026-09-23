"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/shared/date-picker";
import { MethodSelect } from "@/components/accounts/form-bits";
import { recordInvoicePayment } from "@/lib/actions/invoices";
import { formatMoney, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Record a full or part payment against an issued invoice. Either way a
 * receipt is recorded, so the balance shown on group cards, the dashboard, the
 * invoice and Accounts agree, and the invoice flips to Paid once receipts
 * cover the total.
 */
export function PaymentDialog({
  open,
  onOpenChange,
  invoiceId,
  invoiceNumber,
  balance,
  currency,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  invoiceNumber: string;
  balance: number;
  currency: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"full" | "part">("full");
  const [amount, setAmount] = useState("");
  const [receivedOn, setReceivedOn] = useState<string>(todayISO());
  const [method, setMethod] = useState("bank_transfer");
  const [reference, setReference] = useState("");
  const [pending, startTransition] = useTransition();
  const due = Math.max(0, Math.round(balance * 100) / 100);
  const partAmount = Number(amount);
  const partValid = mode === "full" || (Number.isFinite(partAmount) && partAmount > 0 && partAmount <= due + 0.005);

  function reset() {
    setMode("full");
    setAmount("");
    setReceivedOn(todayISO());
    setMethod("bank_transfer");
    setReference("");
  }

  function submit() {
    if (!partValid) return;
    const value = mode === "full" ? due : partAmount;
    startTransition(async () => {
      const res = await recordInvoicePayment({ invoice_id: invoiceId, amount: value, received_on: receivedOn, method, reference });
      if (!res.ok) return void toast.error(res.error);
      onOpenChange(false);
      reset();
      toast.success(res.data.paid ? `${invoiceNumber} paid in full` : `${formatMoney(value, currency)} recorded on ${invoiceNumber} · ${formatMoney(res.data.balance, currency)} still due`);
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (pending) return;
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record payment · {invoiceNumber}</DialogTitle>
          <DialogDescription>Balance due {formatMoney(due, currency)}. A receipt is recorded so Accounts and every balance on screen stay in step.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="How much was paid">
            {(
              [
                { key: "full", title: "Paid in full", hint: formatMoney(due, currency) },
                { key: "part", title: "Part payment", hint: "enter the amount received" },
              ] as const
            ).map((o) => (
              <button
                key={o.key}
                type="button"
                role="radio"
                aria-checked={mode === o.key}
                disabled={pending}
                onClick={() => setMode(o.key)}
                className={cn("rounded-lg border px-3 py-2.5 text-left transition-colors", mode === o.key ? "border-mr-ink bg-mr-surface" : "border-mr-line hover:border-mr-ink/40")}
              >
                <span className="block text-sm font-medium text-mr-ink">{o.title}</span>
                <span className="tnum block text-xs text-mr-muted">{o.hint}</span>
              </button>
            ))}
          </div>
          {mode === "part" && (
            <div className="space-y-1.5">
              <Label htmlFor={`pay-amount-${invoiceId}`}>Amount received ({currency})</Label>
              <Input
                id={`pay-amount-${invoiceId}`}
                type="number"
                inputMode="decimal"
                min={0}
                max={due}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={`Up to ${due.toFixed(2)}`}
                autoFocus
                disabled={pending}
              />
              {amount !== "" && !partValid && <p className="text-xs text-mr-red">Enter an amount between 0.01 and {formatMoney(due, currency)}.</p>}
              {partValid && amount !== "" && partAmount < due && <p className="tnum text-xs text-mr-muted">{formatMoney(due - partAmount, currency)} will still be due.</p>}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`pay-date-${invoiceId}`}>Received on</Label>
              <DatePicker id={`pay-date-${invoiceId}`} value={receivedOn} onChange={(v) => setReceivedOn(v ?? todayISO())} disabled={pending} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`pay-method-${invoiceId}`}>Method</Label>
              <MethodSelect id={`pay-method-${invoiceId}`} value={method} onChange={setMethod} disabled={pending} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`pay-ref-${invoiceId}`}>Reference (optional)</Label>
            <Input id={`pay-ref-${invoiceId}`} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Bank or transaction reference" disabled={pending} />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={pending || !partValid} onClick={submit}>
            {pending && <Loader2 className="animate-spin" />}
            {mode === "full" ? "Mark as paid" : "Record part payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** "Mark as paid" button that opens the payment dialog. Used on group cards, the dashboard and the invoice page. */
export function MarkPaidButton({
  invoiceId,
  invoiceNumber,
  balance,
  currency,
  size = "xs",
  variant = "outline",
  label = "Mark as paid",
}: {
  invoiceId: string;
  invoiceNumber: string;
  balance: number;
  currency: string;
  size?: "xs" | "sm";
  variant?: "outline" | "ghost" | "default";
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant={variant} size={size} onClick={() => setOpen(true)} title="Record a full or part payment">
        <CheckCircle2 /> {label}
      </Button>
      <PaymentDialog open={open} onOpenChange={setOpen} invoiceId={invoiceId} invoiceNumber={invoiceNumber} balance={balance} currency={currency} />
    </>
  );
}
