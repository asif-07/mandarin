"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, MoreHorizontal, Pencil, Plus, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/shared/date-picker";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { GroupCombobox } from "@/components/travel/group-combobox";
import { RecordCombobox } from "@/components/accounts/record-combobox";
import { CurrencySelect, Field, MethodSelect, OptionSelect, type Errors } from "@/components/accounts/form-bits";
import {
  createExpense,
  deleteExpense,
  listBankAccountOptions,
  listExpenseCategoryOptions,
  listPartyOptions,
  markExpensePaid,
  markExpenseUnpaid,
  searchDealsForAccounts,
  updateExpense,
  type BankAccountOption,
  type CategoryOption,
  type DealOption,
  type PartyOption,
} from "@/lib/actions/accounts";
import type { GroupOption } from "@/lib/actions/travel-groups";
import { todayISO } from "@/lib/format";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EXPENSE_STATUSES } from "@/lib/constants";

export type ExpenseRecord = {
  id?: string;
  expense_ref?: string;
  spent_on: string;
  amount: string;
  currency: string;
  category_id: string | null;
  description: string;
  party_id: string | null;
  deal: DealOption | null;
  travel_group_id: string | null;
  group: GroupOption | null;
  status: string;
  due_on: string | null;
  paid_on: string | null;
  method: string;
  bank_account_id: string | null;
  reference: string;
  notes: string;
};

export function emptyExpense(preset?: { deal?: DealOption | null; partyId?: string | null; currency?: string; group?: GroupOption | null }): ExpenseRecord {
  return {
    spent_on: todayISO(),
    amount: "",
    currency: preset?.deal?.currency ?? preset?.currency ?? "CNY",
    category_id: null,
    description: "",
    party_id: preset?.partyId ?? null,
    deal: preset?.deal ?? null,
    travel_group_id: preset?.group?.id ?? null,
    group: preset?.group ?? null,
    status: "paid",
    due_on: null,
    paid_on: todayISO(),
    method: "bank_transfer",
    bank_account_id: null,
    reference: "",
    notes: "",
  };
}

export function ExpenseDialog({ value, onClose }: { value: ExpenseRecord | null; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<ExpenseRecord | null>(value);
  const [errors, setErrors] = useState<Errors>();
  const [accounts, setAccounts] = useState<BankAccountOption[]>([]);
  const [suppliers, setSuppliers] = useState<PartyOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    setForm(value);
    setErrors(undefined);
  }
  useEffect(() => {
    if (value) {
      listBankAccountOptions().then(setAccounts);
      listPartyOptions("supplier").then(setSuppliers);
      listExpenseCategoryOptions().then(setCategories);
    }
  }, [!!value]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof ExpenseRecord>(k: K, v: ExpenseRecord[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const ledgerOptions = accounts.filter((a) => a.currency === form?.currency).map((a) => ({ id: a.id, label: a.name, hint: a.currency }));
  const paid = form?.status === "paid";

  function save() {
    if (!form || !form.category_id) return;
    startTransition(async () => {
      const input = {
        spent_on: form.spent_on,
        amount: Number(form.amount),
        currency: form.currency,
        category_id: form.category_id!,
        description: form.description,
        party_id: form.party_id,
        deal_id: form.deal?.id ?? null,
        travel_group_id: form.travel_group_id,
        status: form.status,
        due_on: form.due_on,
        paid_on: form.paid_on,
        method: form.method,
        bank_account_id: form.bank_account_id,
        reference: form.reference,
        notes: form.notes,
      };
      const result = form.id ? await updateExpense(form.id, input) : await createExpense(input);
      if (!result.ok) {
        setErrors(result.fieldErrors);
        return void toast.error(result.error);
      }
      toast.success(form.id ? "Expense saved" : `${(result.data as { expense_ref?: string }).expense_ref ?? "Expense"} recorded`);
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open={!!value} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{form?.id ? `Edit ${form.expense_ref}` : "Record an expense"}</DialogTitle>
          <DialogDescription>Costs you pay out. Unpaid expenses appear as payables until you mark them paid.</DialogDescription>
        </DialogHeader>
        {form && (
          <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
            <Field label="Description" htmlFor="ex_desc" error={errors?.description} className="sm:col-span-2">
              <Input id="ex_desc" value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Hotel deposit, Oct group" autoFocus />
            </Field>
            <Field label="Category" error={errors?.category_id}>
              <OptionSelect value={form.category_id} onChange={(v) => set("category_id", v)} options={categories.map((c) => ({ id: c.id, label: c.name }))} placeholder="Choose a category" noneLabel={null} />
            </Field>
            <Field label="Date incurred" error={errors?.spent_on}>
              <DatePicker value={form.spent_on} onChange={(v) => set("spent_on", v ?? "")} />
            </Field>
            <div className="grid grid-cols-[1fr_96px] gap-2">
              <Field label="Amount" htmlFor="ex_amount" error={errors?.amount}>
                <Input id="ex_amount" type="number" step="0.01" min="0" inputMode="decimal" className="tnum" value={form.amount} onChange={(e) => set("amount", e.target.value)} />
              </Field>
              <Field label="Currency" error={errors?.currency}>
                <CurrencySelect value={form.currency} onChange={(v) => setForm((f) => (f ? { ...f, currency: v, bank_account_id: null } : f))} />
              </Field>
            </div>
            <Field label="Supplier" error={errors?.party_id}>
              <OptionSelect value={form.party_id} onChange={(v) => set("party_id", v)} options={suppliers.map((p) => ({ id: p.id, label: p.name }))} placeholder="Supplier (optional)" noneLabel="No supplier" />
            </Field>
            <Field label="B2B deal" error={errors?.deal_id}>
              <RecordCombobox
                value={form.deal}
                onChange={(d) => set("deal", d)}
                search={searchDealsForAccounts}
                placeholder="Deal (optional)"
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
            <Field label="Travel group" error={errors?.travel_group_id}>
              <GroupCombobox value={form.travel_group_id} initial={form.group} onChange={(g) => setForm((f) => (f ? { ...f, travel_group_id: g?.id ?? null, group: g } : f))} />
            </Field>
            <Field label="Status" error={errors?.status}>
              <Select value={form.status} onValueChange={(v) => setForm((f) => (f ? { ...f, status: v, paid_on: v === "paid" ? (f.paid_on ?? f.spent_on) : f.paid_on } : f))}>
                <SelectTrigger className="w-full rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {paid ? (
              <>
                <Field label="Paid on" error={errors?.paid_on}>
                  <DatePicker value={form.paid_on} onChange={(v) => set("paid_on", v)} />
                </Field>
                <Field label="Method" error={errors?.method}>
                  <MethodSelect value={form.method} onChange={(v) => set("method", v)} />
                </Field>
                <Field label="From ledger" error={errors?.bank_account_id} hint={ledgerOptions.length === 0 ? `No ${form.currency} ledger yet (Cash & bank)` : undefined}>
                  <OptionSelect value={form.bank_account_id} onChange={(v) => set("bank_account_id", v)} options={ledgerOptions} placeholder="Paid from" noneLabel="Not recorded" />
                </Field>
              </>
            ) : (
              <Field label="Due on" error={errors?.due_on} hint="When the supplier expects payment">
                <DatePicker value={form.due_on} onChange={(v) => set("due_on", v)} clearable placeholder="Optional" />
              </Field>
            )}
            <Field label="Reference" htmlFor="ex_ref" error={errors?.reference} className="sm:col-span-2">
              <Input id="ex_ref" value={form.reference} onChange={(e) => set("reference", e.target.value)} placeholder="Supplier invoice no., transaction id" />
            </Field>
            <Field label="Notes" htmlFor="ex_notes" error={errors?.notes} className="sm:col-span-2">
              <Textarea id="ex_notes" rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
            </Field>
          </fieldset>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending || !form || !Number(form.amount) || !form.category_id || !form.description.trim() || (paid && !form.paid_on)}>
            {pending && <Loader2 className="animate-spin" />} {form?.id ? "Save" : "Record expense"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function NewExpenseButton({
  deal,
  partyId,
  currency,
  group,
  variant = "default",
  size,
  label = "Record expense",
}: {
  deal?: DealOption | null;
  partyId?: string | null;
  currency?: string;
  group?: GroupOption | null;
  variant?: "default" | "outline";
  size?: "sm" | "default";
  label?: string;
}) {
  const [editing, setEditing] = useState<ExpenseRecord | null>(null);
  return (
    <>
      <Button variant={variant} size={size} onClick={() => setEditing(emptyExpense({ deal, partyId, currency, group }))}>
        <Plus /> {label}
      </Button>
      <ExpenseDialog value={editing} onClose={() => setEditing(null)} />
    </>
  );
}

type MarkPaidForm = { paid_on: string; method: string; bank_account_id: string | null; reference: string };

export function ExpenseActions({ expense }: { expense: ExpenseRecord & { id: string; expense_ref: string } }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<ExpenseRecord | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [paying, setPaying] = useState<MarkPaidForm | null>(null);
  const [accounts, setAccounts] = useState<BankAccountOption[]>([]);
  useEffect(() => {
    if (paying) listBankAccountOptions().then(setAccounts);
  }, [!!paying]); // eslint-disable-line react-hooks/exhaustive-deps

  function remove() {
    startTransition(async () => {
      const result = await deleteExpense(expense.id);
      setConfirm(false);
      if (!result.ok) return void toast.error(result.error);
      toast.success(`${expense.expense_ref} deleted`);
      router.refresh();
    });
  }

  function pay() {
    if (!paying) return;
    startTransition(async () => {
      const result = await markExpensePaid(expense.id, paying);
      if (!result.ok) return void toast.error(result.error);
      toast.success(`${expense.expense_ref} marked paid`);
      setPaying(null);
      router.refresh();
    });
  }

  function unpay() {
    startTransition(async () => {
      const result = await markExpenseUnpaid(expense.id);
      if (!result.ok) return void toast.error(result.error);
      toast.success(`${expense.expense_ref} marked unpaid`);
      router.refresh();
    });
  }

  const ledgerOptions = accounts.filter((a) => a.currency === expense.currency).map((a) => ({ id: a.id, label: a.name, hint: a.currency }));

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${expense.expense_ref}`} disabled={pending}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onSelect={() => setEditing(expense)}>
            <Pencil /> Edit
          </DropdownMenuItem>
          {expense.status === "unpaid" ? (
            <DropdownMenuItem onSelect={() => setPaying({ paid_on: todayISO(), method: "bank_transfer", bank_account_id: null, reference: expense.reference })}>
              <CheckCircle2 /> Mark paid
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={unpay}>
              <Undo2 /> Mark unpaid
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setConfirm(true)} className="text-mr-red focus:text-mr-red">
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ExpenseDialog value={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog open={confirm} onOpenChange={setConfirm} title={`Delete ${expense.expense_ref}?`} description="This cannot be undone." confirmLabel="Delete" destructive pending={pending} onConfirm={remove} />
      <Dialog open={!!paying} onOpenChange={(o) => !o && setPaying(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark {expense.expense_ref} as paid</DialogTitle>
            <DialogDescription>{expense.description}</DialogDescription>
          </DialogHeader>
          {paying && (
            <fieldset disabled={pending} className="grid gap-4">
              <Field label="Paid on">
                <DatePicker value={paying.paid_on} onChange={(v) => setPaying({ ...paying, paid_on: v ?? "" })} />
              </Field>
              <Field label="Method">
                <MethodSelect value={paying.method} onChange={(v) => setPaying({ ...paying, method: v })} />
              </Field>
              <Field label="From ledger" hint={ledgerOptions.length === 0 ? `No ${expense.currency} ledger yet` : undefined}>
                <OptionSelect value={paying.bank_account_id} onChange={(v) => setPaying({ ...paying, bank_account_id: v })} options={ledgerOptions} placeholder="Paid from" noneLabel="Not recorded" />
              </Field>
              <Field label="Reference" htmlFor="mp_ref">
                <Input id="mp_ref" value={paying.reference} onChange={(e) => setPaying({ ...paying, reference: e.target.value })} />
              </Field>
            </fieldset>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaying(null)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={pay} disabled={pending || !paying?.paid_on}>
              {pending && <Loader2 className="animate-spin" />} Mark paid
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
