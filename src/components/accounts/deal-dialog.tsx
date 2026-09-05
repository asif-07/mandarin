"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2, Link2, Loader2, MoreHorizontal, Pencil, Play, Plus, Trash2, Unlink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/shared/date-picker";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { GroupCombobox } from "@/components/travel/group-combobox";
import { RecordCombobox } from "@/components/accounts/record-combobox";
import { CurrencySelect, Field, OptionSelect, type Errors } from "@/components/accounts/form-bits";
import {
  createDeal,
  deleteDeal,
  linkInvoiceToDeal,
  listPartyOptions,
  searchInvoicesForAccounts,
  setDealStatus,
  unlinkInvoiceFromDeal,
  updateDeal,
  type InvoiceOption,
  type PartyOption,
} from "@/lib/actions/accounts";
import type { GroupOption } from "@/lib/actions/travel-groups";
import { DEAL_STATUSES } from "@/lib/constants";
import { formatDate, formatMoney } from "@/lib/format";

export type DealRecord = {
  id?: string;
  deal_ref?: string;
  party_id: string | null;
  title: string;
  description: string;
  status: string;
  currency: string;
  deal_value: string;
  pax_count: string;
  start_date: string | null;
  end_date: string | null;
  payment_due_on: string | null;
  travel_group_id: string | null;
  group: GroupOption | null;
  notes: string;
};

export function emptyDeal(partyId: string | null = null, currency = "USD"): DealRecord {
  return {
    party_id: partyId,
    title: "",
    description: "",
    status: "active",
    currency,
    deal_value: "",
    pax_count: "",
    start_date: null,
    end_date: null,
    payment_due_on: null,
    travel_group_id: null,
    group: null,
    notes: "",
  };
}

export function DealDialog({ value, onClose, onSaved }: { value: DealRecord | null; onClose: () => void; onSaved?: (id: string) => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<DealRecord | null>(value);
  const [errors, setErrors] = useState<Errors>();
  const [parties, setParties] = useState<PartyOption[]>([]);
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    setForm(value);
    setErrors(undefined);
  }
  useEffect(() => {
    if (value) listPartyOptions("partner").then(setParties);
  }, [!!value]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof DealRecord>(k: K, v: DealRecord[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  function save() {
    if (!form || !form.party_id) return;
    startTransition(async () => {
      const input = {
        ...form,
        party_id: form.party_id!,
        deal_value: Number(form.deal_value || 0),
        pax_count: form.pax_count === "" ? null : Number(form.pax_count),
      };
      const result = form.id ? await updateDeal(form.id, input) : await createDeal(input);
      if (!result.ok) {
        setErrors(result.fieldErrors);
        return void toast.error(result.error);
      }
      toast.success(form.id ? "Deal saved" : `${(result.data as { deal_ref?: string }).deal_ref ?? "Deal"} created`);
      onSaved?.(result.data.id);
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open={!!value} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{form?.id ? `Edit ${form.deal_ref}` : "New B2B deal"}</DialogTitle>
          <DialogDescription>An agreement with a partner. Invoices, receipts and costs are tracked against it.</DialogDescription>
        </DialogHeader>
        {form && (
          <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
            <Field label="Partner" error={errors?.party_id} className="sm:col-span-2">
              <OptionSelect
                value={form.party_id}
                onChange={(v) => {
                  const p = parties.find((x) => x.id === v);
                  setForm((f) => (f ? { ...f, party_id: v, currency: !f.id && p ? p.default_currency : f.currency } : f));
                }}
                options={parties.map((p) => ({ id: p.id, label: p.name }))}
                placeholder={parties.length ? "Choose a partner" : "Add a partner first (Partners & suppliers)"}
                noneLabel={null}
              />
            </Field>
            <Field label="Title" htmlFor="deal_title" error={errors?.title} className="sm:col-span-2">
              <Input id="deal_title" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Canton Fair group, Oct 2026" autoFocus />
            </Field>
            <Field label="Currency" error={errors?.currency} hint={form.id ? "Fixed while invoices are linked" : undefined}>
              <CurrencySelect value={form.currency} onChange={(v) => set("currency", v)} />
            </Field>
            <Field label={`Deal value (${form.currency})`} htmlFor="deal_value" error={errors?.deal_value} hint="Total agreed with the partner">
              <Input id="deal_value" type="number" step="0.01" min="0" inputMode="decimal" className="tnum" value={form.deal_value} onChange={(e) => set("deal_value", e.target.value)} />
            </Field>
            <Field label="Status" error={errors?.status}>
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger className="w-full rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEAL_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Pax" htmlFor="deal_pax" error={errors?.pax_count}>
              <Input id="deal_pax" type="number" min="0" inputMode="numeric" className="tnum" value={form.pax_count} onChange={(e) => set("pax_count", e.target.value)} />
            </Field>
            <Field label="Travel start" error={errors?.start_date}>
              <DatePicker value={form.start_date} onChange={(v) => set("start_date", v)} clearable placeholder="Optional" />
            </Field>
            <Field label="Travel end" error={errors?.end_date}>
              <DatePicker value={form.end_date} onChange={(v) => set("end_date", v)} clearable placeholder="Optional" />
            </Field>
            <Field label="Payment due" error={errors?.payment_due_on} hint="Used for the overdue list">
              <DatePicker value={form.payment_due_on} onChange={(v) => set("payment_due_on", v)} clearable placeholder="Optional" />
            </Field>
            <Field label="Travel group" error={errors?.travel_group_id}>
              <GroupCombobox
                value={form.travel_group_id}
                initial={form.group}
                onChange={(g) => setForm((f) => (f ? { ...f, travel_group_id: g?.id ?? null, group: g } : f))}
              />
            </Field>
            <Field label="Description" htmlFor="deal_desc" error={errors?.description} className="sm:col-span-2">
              <Textarea id="deal_desc" rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="What is included, hotel category, extras…" />
            </Field>
            <Field label="Notes" htmlFor="deal_notes" error={errors?.notes} className="sm:col-span-2">
              <Textarea id="deal_notes" rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
            </Field>
          </fieldset>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending || !form?.party_id || !form?.title.trim()}>
            {pending && <Loader2 className="animate-spin" />} {form?.id ? "Save" : "Create deal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function NewDealButton({ partyId, currency, variant = "default" }: { partyId?: string; currency?: string; variant?: "default" | "outline" }) {
  const router = useRouter();
  const [editing, setEditing] = useState<DealRecord | null>(null);
  return (
    <>
      <Button variant={variant} onClick={() => setEditing(emptyDeal(partyId ?? null, currency ?? "USD"))}>
        <Plus /> New deal
      </Button>
      <DealDialog value={editing} onClose={() => setEditing(null)} onSaved={(id) => router.push(`/accounts/deals/${id}`)} />
    </>
  );
}

export function DealActions({ deal, showOpen = false }: { deal: DealRecord & { id: string; deal_ref: string }; showOpen?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<DealRecord | null>(null);
  const [confirm, setConfirm] = useState<"delete" | "cancel" | null>(null);

  function status(next: string) {
    startTransition(async () => {
      const result = await setDealStatus(deal.id, next);
      setConfirm(null);
      if (!result.ok) return void toast.error(result.error);
      toast.success(`${deal.deal_ref} marked ${next}`);
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteDeal(deal.id);
      setConfirm(null);
      if (!result.ok) return void toast.error(result.error);
      toast.success(`${deal.deal_ref} deleted`);
      router.push("/accounts/deals");
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${deal.deal_ref}`} disabled={pending}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {showOpen && <DropdownMenuItem onSelect={() => router.push(`/accounts/deals/${deal.id}`)}>Open</DropdownMenuItem>}
          <DropdownMenuItem onSelect={() => setEditing(deal)}>
            <Pencil /> Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {deal.status !== "active" && deal.status !== "cancelled" && (
            <DropdownMenuItem onSelect={() => status("active")}>
              <Play /> Mark active
            </DropdownMenuItem>
          )}
          {deal.status === "active" && (
            <DropdownMenuItem onSelect={() => status("completed")}>
              <CheckCircle2 /> Mark completed
            </DropdownMenuItem>
          )}
          {deal.status !== "cancelled" && (
            <DropdownMenuItem onSelect={() => setConfirm("cancel")} className="text-mr-red focus:text-mr-red">
              <Ban /> Cancel deal
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => setConfirm("delete")} className="text-mr-red focus:text-mr-red">
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DealDialog value={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={confirm === "cancel"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Cancel ${deal.deal_ref}?`}
        description="The deal is kept for the record and drops out of receivables."
        confirmLabel="Cancel deal"
        destructive
        pending={pending}
        onConfirm={() => status("cancelled")}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Delete ${deal.deal_ref}?`}
        description="Only possible when no receipts or expenses are recorded against it. Linked invoices are kept and unlinked."
        confirmLabel="Delete"
        destructive
        pending={pending}
        onConfirm={remove}
      />
    </>
  );
}

/** Attach an existing invoice (same currency, not yet on another deal) to a deal. */
export function LinkInvoiceButton({ dealId, currency }: { dealId: string; currency: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [invoice, setInvoice] = useState<InvoiceOption | null>(null);

  function link() {
    if (!invoice) return;
    startTransition(async () => {
      const result = await linkInvoiceToDeal(dealId, invoice.id);
      if (!result.ok) return void toast.error(result.error);
      toast.success(`${result.data.invoice_number} linked`);
      setOpen(false);
      setInvoice(null);
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Link2 /> Link invoice
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Link an invoice to this deal</DialogTitle>
            <DialogDescription>Only {currency} invoices that are not on another deal. Payments already recorded on it count towards the deal.</DialogDescription>
          </DialogHeader>
          <Field label="Invoice">
            <RecordCombobox
              value={invoice}
              onChange={setInvoice}
              search={(q) => searchInvoicesForAccounts(q, { dealId })}
              placeholder="Search invoice number or name"
              renderValue={(i) => `${i.invoice_number} · ${i.bill_to_name}`}
              renderOption={(i) => (
                <span className="flex items-center gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{i.invoice_number}</span>
                    <span className="block truncate text-xs text-mr-muted">
                      {i.bill_to_name} · {formatDate(i.issue_date)}
                    </span>
                  </span>
                  <span className="tnum text-xs">{formatMoney(i.total, i.currency)}</span>
                </span>
              )}
            />
          </Field>
          {invoice && invoice.currency !== currency && <p className="text-xs text-mr-red">This invoice is in {invoice.currency}; the deal is in {currency}.</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={link} disabled={pending || !invoice || invoice.currency !== currency}>
              {pending && <Loader2 className="animate-spin" />} Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function UnlinkInvoiceButton({ invoiceId, invoiceNumber }: { invoiceId: string; invoiceNumber: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={`Unlink ${invoiceNumber}`}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await unlinkInvoiceFromDeal(invoiceId);
          if (!result.ok) return void toast.error(result.error);
          toast.success(`${invoiceNumber} unlinked`);
          router.refresh();
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <Unlink />}
    </Button>
  );
}
