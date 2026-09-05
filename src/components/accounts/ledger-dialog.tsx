"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/shared/date-picker";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { CurrencySelect, Field, OptionSelect, type Errors } from "@/components/accounts/form-bits";
import {
  createBankAccount,
  createTransfer,
  deleteBankAccount,
  deleteTransfer,
  listBankAccountOptions,
  updateBankAccount,
  type BankAccountOption,
} from "@/lib/actions/accounts";
import { BANK_ACCOUNT_TYPES } from "@/lib/constants";
import { formatMoney, todayISO } from "@/lib/format";

export type LedgerRecord = {
  id?: string;
  name: string;
  account_type: string;
  currency: string;
  opening_balance: string;
  opening_date: string;
  bank_name: string;
  account_number: string;
  notes: string;
  is_active: boolean;
};

export function emptyLedger(): LedgerRecord {
  return { name: "", account_type: "bank", currency: "USD", opening_balance: "0", opening_date: todayISO(), bank_name: "", account_number: "", notes: "", is_active: true };
}

export function LedgerDialog({ value, onClose }: { value: LedgerRecord | null; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<LedgerRecord | null>(value);
  const [errors, setErrors] = useState<Errors>();
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    setForm(value);
    setErrors(undefined);
  }
  const set = <K extends keyof LedgerRecord>(k: K, v: LedgerRecord[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  function save() {
    if (!form) return;
    startTransition(async () => {
      const input = { ...form, opening_balance: Number(form.opening_balance) };
      const result = form.id ? await updateBankAccount(form.id, input) : await createBankAccount(input);
      if (!result.ok) {
        setErrors(result.fieldErrors);
        return void toast.error(result.error);
      }
      toast.success(form.id ? "Saved" : `${form.name} added`);
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open={!!value} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{form?.id ? "Edit ledger" : "New cash or bank ledger"}</DialogTitle>
          <DialogDescription>One ledger per account and currency. Receipts and paid expenses move its balance.</DialogDescription>
        </DialogHeader>
        {form && (
          <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="ledger_name" error={errors?.name} className="sm:col-span-2">
              <Input id="ledger_name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="ICBC current account" autoFocus />
            </Field>
            <Field label="Type" error={errors?.account_type}>
              <Select value={form.account_type} onValueChange={(v) => set("account_type", v)}>
                <SelectTrigger className="w-full rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BANK_ACCOUNT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Currency" error={errors?.currency} hint={form.id ? "Fixed once transactions exist" : undefined}>
              <CurrencySelect value={form.currency} onChange={(v) => set("currency", v)} />
            </Field>
            <Field label="Opening balance" htmlFor="ledger_opening" error={errors?.opening_balance}>
              <Input id="ledger_opening" type="number" step="0.01" inputMode="decimal" className="tnum" value={form.opening_balance} onChange={(e) => set("opening_balance", e.target.value)} />
            </Field>
            <Field label="Opening date" error={errors?.opening_date}>
              <DatePicker value={form.opening_date} onChange={(v) => set("opening_date", v ?? "")} />
            </Field>
            <Field label="Bank" htmlFor="ledger_bank" error={errors?.bank_name}>
              <Input id="ledger_bank" value={form.bank_name} onChange={(e) => set("bank_name", e.target.value)} />
            </Field>
            <Field label="Account no. (last digits)" htmlFor="ledger_number" error={errors?.account_number}>
              <Input id="ledger_number" value={form.account_number} onChange={(e) => set("account_number", e.target.value)} />
            </Field>
            <Field label="Notes" htmlFor="ledger_notes" error={errors?.notes} className="sm:col-span-2">
              <Textarea id="ledger_notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} />
            </Field>
            {form.id && (
              <label className="flex items-center gap-3 text-sm sm:col-span-2">
                <Switch checked={form.is_active} onCheckedChange={(v) => set("is_active", v)} />
                Active (shown in pickers)
              </label>
            )}
          </fieldset>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending || !form?.name.trim()}>
            {pending && <Loader2 className="animate-spin" />} {form?.id ? "Save" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function NewLedgerButton({ variant = "default" }: { variant?: "default" | "outline" }) {
  const [editing, setEditing] = useState<LedgerRecord | null>(null);
  return (
    <>
      <Button variant={variant} onClick={() => setEditing(emptyLedger())}>
        <Plus /> New ledger
      </Button>
      <LedgerDialog value={editing} onClose={() => setEditing(null)} />
    </>
  );
}

export function LedgerRowActions({ ledger }: { ledger: LedgerRecord & { id: string } }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<LedgerRecord | null>(null);
  const [confirm, setConfirm] = useState(false);

  function remove() {
    startTransition(async () => {
      const result = await deleteBankAccount(ledger.id);
      setConfirm(false);
      if (!result.ok) return void toast.error(result.error);
      toast.success(`${ledger.name} deleted`);
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${ledger.name}`} disabled={pending}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onSelect={() => setEditing(ledger)}>
            <Pencil /> Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setConfirm(true)} className="text-mr-red focus:text-mr-red">
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <LedgerDialog value={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Delete ${ledger.name}?`}
        description="Only possible when nothing has been recorded against it. Otherwise mark it inactive."
        confirmLabel="Delete"
        destructive
        pending={pending}
        onConfirm={remove}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// transfers
// ---------------------------------------------------------------------------
type TransferForm = { transferred_on: string; from_account_id: string | null; to_account_id: string | null; amount_out: string; amount_in: string; reference: string; notes: string };

export function TransferButton({ variant = "outline" }: { variant?: "default" | "outline" }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<TransferForm | null>(null);
  const [errors, setErrors] = useState<Errors>();
  const [accounts, setAccounts] = useState<BankAccountOption[]>([]);

  useEffect(() => {
    if (form) listBankAccountOptions().then(setAccounts);
  }, [!!form]); // eslint-disable-line react-hooks/exhaustive-deps

  const from = accounts.find((a) => a.id === form?.from_account_id);
  const to = accounts.find((a) => a.id === form?.to_account_id);
  const crossCurrency = !!from && !!to && from.currency !== to.currency;

  function save() {
    if (!form || !form.from_account_id || !form.to_account_id) return;
    startTransition(async () => {
      const result = await createTransfer({
        ...form,
        from_account_id: form.from_account_id!,
        to_account_id: form.to_account_id!,
        amount_out: Number(form.amount_out),
        amount_in: crossCurrency ? Number(form.amount_in) : null,
      });
      if (!result.ok) {
        setErrors(result.fieldErrors);
        return void toast.error(result.error);
      }
      toast.success("Transfer recorded");
      setForm(null);
      router.refresh();
    });
  }

  const options = accounts.map((a) => ({ id: a.id, label: a.name, hint: a.currency }));

  return (
    <>
      <Button
        variant={variant}
        onClick={() => {
          setErrors(undefined);
          setForm({ transferred_on: todayISO(), from_account_id: null, to_account_id: null, amount_out: "", amount_in: "", reference: "", notes: "" });
        }}
      >
        <ArrowLeftRight /> Transfer
      </Button>
      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Transfer between ledgers</DialogTitle>
            <DialogDescription>Cash deposited to the bank, or money moved between accounts or currencies.</DialogDescription>
          </DialogHeader>
          {form && (
            <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
              <Field label="Date" error={errors?.transferred_on} className="sm:col-span-2">
                <DatePicker value={form.transferred_on} onChange={(v) => setForm({ ...form, transferred_on: v ?? "" })} />
              </Field>
              <Field label="From" error={errors?.from_account_id}>
                <OptionSelect value={form.from_account_id} onChange={(v) => setForm({ ...form, from_account_id: v })} options={options} placeholder="Source" noneLabel={null} />
              </Field>
              <Field label="To" error={errors?.to_account_id}>
                <OptionSelect value={form.to_account_id} onChange={(v) => setForm({ ...form, to_account_id: v })} options={options} placeholder="Destination" noneLabel={null} />
              </Field>
              <Field label={`Amount out${from ? ` (${from.currency})` : ""}`} htmlFor="tf_out" error={errors?.amount_out} className={crossCurrency ? "" : "sm:col-span-2"}>
                <Input id="tf_out" type="number" step="0.01" min="0" inputMode="decimal" className="tnum" value={form.amount_out} onChange={(e) => setForm({ ...form, amount_out: e.target.value })} />
              </Field>
              {crossCurrency && (
                <Field label={`Amount in (${to!.currency})`} htmlFor="tf_in" error={errors?.amount_in} hint={from && form.amount_out ? `Sending ${formatMoney(Number(form.amount_out), from.currency)}` : undefined}>
                  <Input id="tf_in" type="number" step="0.01" min="0" inputMode="decimal" className="tnum" value={form.amount_in} onChange={(e) => setForm({ ...form, amount_in: e.target.value })} />
                </Field>
              )}
              <Field label="Reference" htmlFor="tf_ref" error={errors?.reference} className="sm:col-span-2">
                <Input id="tf_ref" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
              </Field>
              <Field label="Notes" htmlFor="tf_notes" error={errors?.notes} className="sm:col-span-2">
                <Textarea id="tf_notes" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </Field>
            </fieldset>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={save} disabled={pending || !form?.from_account_id || !form?.to_account_id || !Number(form?.amount_out) || (crossCurrency && !Number(form?.amount_in))}>
              {pending && <Loader2 className="animate-spin" />} Record transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function DeleteTransferButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <Button variant="ghost" size="icon-sm" aria-label="Delete transfer" disabled={pending} onClick={() => setConfirm(true)}>
        {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
      </Button>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Delete this transfer?"
        description="Both ledger balances will move back."
        confirmLabel="Delete"
        destructive
        pending={pending}
        onConfirm={() =>
          startTransition(async () => {
            const result = await deleteTransfer(id);
            setConfirm(false);
            if (!result.ok) return void toast.error(result.error);
            toast.success("Transfer deleted");
            router.refresh();
          })
        }
      />
    </>
  );
}
