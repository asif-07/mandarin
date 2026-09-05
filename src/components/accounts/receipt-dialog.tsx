"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Banknote, Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/shared/date-picker";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { RecordCombobox } from "@/components/accounts/record-combobox";
import { CurrencySelect, Field, MethodSelect, OptionSelect, type Errors } from "@/components/accounts/form-bits";
import {
  createReceipt,
  deleteReceipt,
  listBankAccountOptions,
  listPartyOptions,
  searchDealsForAccounts,
  searchInvoicesForAccounts,
  updateReceipt,
  type BankAccountOption,
  type DealOption,
  type InvoiceOption,
  type PartyOption,
} from "@/lib/actions/accounts";
import { formatDate, formatMoney, todayISO } from "@/lib/format";

export type ReceiptRecord = {
  id?: string;
  receipt_ref?: string;
  received_on: string;
  amount: string;
  currency: string;
  applied_amount: string;
  method: string;
  bank_account_id: string | null;
  invoice: InvoiceOption | null;
  deal: DealOption | null;
  party_id: string | null;
  payer_name: string;
  reference: string;
  notes: string;
};

export function emptyReceipt(preset?: { invoice?: InvoiceOption | null; deal?: DealOption | null; partyId?: string | null; currency?: string }): ReceiptRecord {
  const currency = preset?.invoice?.currency ?? preset?.deal?.currency ?? preset?.currency ?? "USD";
  const balance = preset?.invoice ? preset.invoice.balance : 0;
  return {
    received_on: todayISO(),
    amount: balance > 0 ? String(balance) : "",
    currency,
    applied_amount: "",
    method: "bank_transfer",
    bank_account_id: null,
    invoice: preset?.invoice ?? null,
    deal: preset?.deal ?? null,
    party_id: preset?.partyId ?? preset?.deal?.party_id ?? null,
    payer_name: "",
    reference: "",
    notes: "",
  };
}

export function ReceiptDialog({ value, onClose, lockLinks = false }: { value: ReceiptRecord | null; onClose: () => void; lockLinks?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<ReceiptRecord | null>(value);
  const [errors, setErrors] = useState<Errors>();
  const [accounts, setAccounts] = useState<BankAccountOption[]>([]);
  const [parties, setParties] = useState<PartyOption[]>([]);
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    setForm(value);
    setErrors(undefined);
  }
  useEffect(() => {
    if (value) {
      listBankAccountOptions().then(setAccounts);
      listPartyOptions("partner").then(setParties);
    }
  }, [!!value]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof ReceiptRecord>(k: K, v: ReceiptRecord[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const targetCurrency = form?.invoice?.currency ?? form?.deal?.currency ?? null;
  const needsApplied = !!form && !!targetCurrency && targetCurrency !== form.currency;
  const ledgerOptions = accounts.filter((a) => a.currency === form?.currency).map((a) => ({ id: a.id, label: a.name, hint: a.currency }));

  function save() {
    if (!form) return;
    startTransition(async () => {
      const input = {
        received_on: form.received_on,
        amount: Number(form.amount),
        currency: form.currency,
        applied_amount: needsApplied ? Number(form.applied_amount) : null,
        method: form.method,
        bank_account_id: form.bank_account_id,
        invoice_id: form.invoice?.id ?? null,
        deal_id: form.deal?.id ?? null,
        party_id: form.party_id,
        payer_name: form.payer_name,
        reference: form.reference,
        notes: form.notes,
      };
      const result = form.id ? await updateReceipt(form.id, input) : await createReceipt(input);
      if (!result.ok) {
        setErrors(result.fieldErrors);
        return void toast.error(result.error);
      }
      toast.success(form.id ? "Receipt saved" : `${(result.data as { receipt_ref?: string }).receipt_ref ?? "Receipt"} recorded`);
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open={!!value} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{form?.id ? `Edit ${form.receipt_ref}` : "Record money received"}</DialogTitle>
          <DialogDescription>
            {form?.invoice
              ? `Against ${form.invoice.invoice_number} · ${form.invoice.bill_to_name}${form.id ? "" : ` · ${formatMoney(form.invoice.balance, form.invoice.currency)} outstanding`}`
              : form?.deal
                ? `Against ${form.deal.deal_ref} · ${form.deal.title}`
                : "Link it to an invoice or a deal, or leave both empty for other income."}
          </DialogDescription>
        </DialogHeader>
        {form && (
          <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
            <Field label="Date received" error={errors?.received_on}>
              <DatePicker value={form.received_on} onChange={(v) => set("received_on", v ?? "")} />
            </Field>
            <div className="grid grid-cols-[1fr_96px] gap-2">
              <Field label="Amount" htmlFor="rc_amount" error={errors?.amount}>
                <Input id="rc_amount" type="number" step="0.01" min="0" inputMode="decimal" className="tnum" value={form.amount} onChange={(e) => set("amount", e.target.value)} autoFocus />
              </Field>
              <Field label="Currency" error={errors?.currency}>
                <CurrencySelect value={form.currency} onChange={(v) => setForm((f) => (f ? { ...f, currency: v, bank_account_id: null } : f))} />
              </Field>
            </div>
            {needsApplied && (
              <Field
                label={`Applied amount (${targetCurrency})`}
                htmlFor="rc_applied"
                error={errors?.applied_amount}
                className="sm:col-span-2"
                hint={`The linked ${form.invoice ? "invoice" : "deal"} is in ${targetCurrency}. Enter how much of it this ${form.currency} payment settles.`}
              >
                <Input id="rc_applied" type="number" step="0.01" min="0" inputMode="decimal" className="tnum" value={form.applied_amount} onChange={(e) => set("applied_amount", e.target.value)} />
              </Field>
            )}
            <Field label="Method" error={errors?.method}>
              <MethodSelect value={form.method} onChange={(v) => set("method", v)} />
            </Field>
            <Field label="Into ledger" error={errors?.bank_account_id} hint={ledgerOptions.length === 0 ? `No ${form.currency} ledger yet (Cash & bank)` : undefined}>
              <OptionSelect value={form.bank_account_id} onChange={(v) => set("bank_account_id", v)} options={ledgerOptions} placeholder="Where it landed" noneLabel="Not recorded" />
            </Field>
            {!lockLinks && (
              <>
                <Field label="Invoice" error={errors?.invoice_id}>
                  <RecordCombobox
                    value={form.invoice}
                    onChange={(inv) =>
                      setForm((f) =>
                        f
                          ? {
                              ...f,
                              invoice: inv,
                              currency: inv && !f.id ? inv.currency : f.currency,
                              amount: inv && !f.id && !f.amount ? String(inv.balance) : f.amount,
                            }
                          : f,
                      )
                    }
                    search={(q) => searchInvoicesForAccounts(q, { openOnly: true })}
                    placeholder="Open invoice"
                    renderValue={(i) => `${i.invoice_number} · ${i.bill_to_name}`}
                    renderOption={(i) => (
                      <span className="flex items-center gap-3">
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">{i.invoice_number}</span>
                          <span className="block truncate text-xs text-mr-muted">
                            {i.bill_to_name} · {formatDate(i.issue_date)}
                          </span>
                        </span>
                        <span className="tnum text-xs">{formatMoney(i.balance, i.currency)} due</span>
                      </span>
                    )}
                  />
                </Field>
                <Field label="B2B deal" error={errors?.deal_id} hint={form.invoice?.deal_id ? "Set from the invoice" : undefined}>
                  <RecordCombobox
                    value={form.deal}
                    onChange={(d) => setForm((f) => (f ? { ...f, deal: d, party_id: d ? d.party_id : f.party_id } : f))}
                    search={searchDealsForAccounts}
                    placeholder="Deal (optional)"
                    disabled={!!form.invoice?.deal_id}
                    renderValue={(d) => `${d.deal_ref} · ${d.title}`}
                    renderOption={(d) => (
                      <span className="min-w-0">
                        <span className="block font-medium">
                          {d.deal_ref} <span className="font-normal text-mr-body">{d.title}</span>
                        </span>
                        <span className="block truncate text-xs text-mr-muted">
                          {d.party_name} · {d.currency}
                        </span>
                      </span>
                    )}
                  />
                </Field>
              </>
            )}
            <Field label="From partner" error={errors?.party_id}>
              <OptionSelect value={form.party_id} onChange={(v) => set("party_id", v)} options={parties.map((p) => ({ id: p.id, label: p.name }))} placeholder="Partner (optional)" noneLabel="Not a partner" />
            </Field>
            <Field label="Payer name" htmlFor="rc_payer" error={errors?.payer_name} hint="If different from the invoice or partner">
              <Input id="rc_payer" value={form.payer_name} onChange={(e) => set("payer_name", e.target.value)} />
            </Field>
            <Field label="Bank / transaction reference" htmlFor="rc_ref" error={errors?.reference} className="sm:col-span-2">
              <Input id="rc_ref" value={form.reference} onChange={(e) => set("reference", e.target.value)} />
            </Field>
            <Field label="Notes" htmlFor="rc_notes" error={errors?.notes} className="sm:col-span-2">
              <Textarea id="rc_notes" rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
            </Field>
          </fieldset>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending || !form || !Number(form.amount) || !form.received_on || (needsApplied && !Number(form.applied_amount))}>
            {pending && <Loader2 className="animate-spin" />} {form?.id ? "Save" : "Record receipt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RecordReceiptButton({
  invoice,
  deal,
  partyId,
  label = "Record receipt",
  variant = "default",
  size,
}: {
  invoice?: InvoiceOption | null;
  deal?: DealOption | null;
  partyId?: string | null;
  label?: string;
  variant?: "default" | "outline";
  size?: "sm" | "default";
}) {
  const [editing, setEditing] = useState<ReceiptRecord | null>(null);
  return (
    <>
      <Button variant={variant} size={size} onClick={() => setEditing(emptyReceipt({ invoice, deal, partyId }))}>
        <Banknote /> {label}
      </Button>
      <ReceiptDialog value={editing} onClose={() => setEditing(null)} lockLinks={!!invoice} />
    </>
  );
}

export function ReceiptActions({ receipt }: { receipt: ReceiptRecord & { id: string; receipt_ref: string } }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<ReceiptRecord | null>(null);
  const [confirm, setConfirm] = useState(false);

  function remove() {
    startTransition(async () => {
      const result = await deleteReceipt(receipt.id);
      setConfirm(false);
      if (!result.ok) return void toast.error(result.error);
      toast.success(`${receipt.receipt_ref} deleted`);
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${receipt.receipt_ref}`} disabled={pending}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onSelect={() => setEditing(receipt)}>
            <Pencil /> Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setConfirm(true)} className="text-mr-red focus:text-mr-red">
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ReceiptDialog value={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Delete ${receipt.receipt_ref}?`}
        description="The linked invoice goes back to issued if it is no longer fully paid, and the ledger balance moves back."
        confirmLabel="Delete"
        destructive
        pending={pending}
        onConfirm={remove}
      />
    </>
  );
}
