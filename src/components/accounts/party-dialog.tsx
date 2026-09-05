"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { CurrencySelect, Field, type Errors } from "@/components/accounts/form-bits";
import { createParty, deleteParty, updateParty } from "@/lib/actions/accounts";
import { PARTY_TYPES } from "@/lib/constants";

export type PartyRecord = {
  id?: string;
  name: string;
  party_type: string;
  contact_name: string;
  phone: string;
  email: string;
  address: string;
  country: string;
  default_currency: string;
  payment_terms: string;
  notes: string;
  is_active: boolean;
};

export function emptyParty(type = "b2b_partner"): PartyRecord {
  return { name: "", party_type: type, contact_name: "", phone: "", email: "", address: "", country: "", default_currency: "USD", payment_terms: "", notes: "", is_active: true };
}

export function PartyDialog({
  value,
  onClose,
  onSaved,
}: {
  value: PartyRecord | null;
  onClose: () => void;
  onSaved?: (id: string) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<PartyRecord | null>(value);
  const [errors, setErrors] = useState<Errors>();
  // Reset local state whenever a different record is opened.
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    setForm(value);
    setErrors(undefined);
  }

  function save() {
    if (!form) return;
    startTransition(async () => {
      const result = form.id ? await updateParty(form.id, form) : await createParty(form);
      if (!result.ok) {
        setErrors(result.fieldErrors);
        return void toast.error(result.error);
      }
      toast.success(form.id ? "Saved" : `${form.name} added`);
      onSaved?.(result.data.id);
      onClose();
      router.refresh();
    });
  }

  const set = <K extends keyof PartyRecord>(k: K, v: PartyRecord[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  return (
    <Dialog open={!!value} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{form?.id ? "Edit party" : "New partner or supplier"}</DialogTitle>
          <DialogDescription>B2B partners send you business; suppliers are who you pay.</DialogDescription>
        </DialogHeader>
        {form && (
          <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="party_name" error={errors?.name} className="sm:col-span-2">
              <Input id="party_name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Gulf Travel LLC" autoFocus />
            </Field>
            <Field label="Type" error={errors?.party_type}>
              <Select value={form.party_type} onValueChange={(v) => set("party_type", v)}>
                <SelectTrigger className="w-full rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PARTY_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Default currency" error={errors?.default_currency}>
              <CurrencySelect value={form.default_currency} onChange={(v) => set("default_currency", v)} />
            </Field>
            <Field label="Contact person" htmlFor="party_contact" error={errors?.contact_name}>
              <Input id="party_contact" value={form.contact_name} onChange={(e) => set("contact_name", e.target.value)} />
            </Field>
            <Field label="Phone" htmlFor="party_phone" error={errors?.phone}>
              <Input id="party_phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+971 50 000 0000" />
            </Field>
            <Field label="Email" htmlFor="party_email" error={errors?.email}>
              <Input id="party_email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </Field>
            <Field label="Country" htmlFor="party_country" error={errors?.country}>
              <Input id="party_country" value={form.country} onChange={(e) => set("country", e.target.value)} placeholder="UAE" />
            </Field>
            <Field label="Address" htmlFor="party_address" error={errors?.address} className="sm:col-span-2">
              <Input id="party_address" value={form.address} onChange={(e) => set("address", e.target.value)} />
            </Field>
            <Field label="Payment terms" htmlFor="party_terms" error={errors?.payment_terms} className="sm:col-span-2" hint="Free text, e.g. 50% advance, balance 7 days before travel">
              <Input id="party_terms" value={form.payment_terms} onChange={(e) => set("payment_terms", e.target.value)} />
            </Field>
            <Field label="Notes" htmlFor="party_notes" error={errors?.notes} className="sm:col-span-2">
              <Textarea id="party_notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} />
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

export function NewPartyButton({ type, variant = "default", label = "New party" }: { type?: string; variant?: "default" | "outline"; label?: string }) {
  const [editing, setEditing] = useState<PartyRecord | null>(null);
  return (
    <>
      <Button variant={variant} onClick={() => setEditing(emptyParty(type))}>
        <Plus /> {label}
      </Button>
      <PartyDialog value={editing} onClose={() => setEditing(null)} />
    </>
  );
}

export function PartyRowActions({ party }: { party: PartyRecord & { id: string } }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<PartyRecord | null>(null);
  const [confirm, setConfirm] = useState(false);

  function remove() {
    startTransition(async () => {
      const result = await deleteParty(party.id);
      setConfirm(false);
      if (!result.ok) return void toast.error(result.error);
      toast.success(`${party.name} deleted`);
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${party.name}`} disabled={pending}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onSelect={() => setEditing(party)}>
            <Pencil /> Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setConfirm(true)} className="text-mr-red focus:text-mr-red">
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <PartyDialog value={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Delete ${party.name}?`}
        description="Only possible when the party has no deals, receipts or expenses. Otherwise mark it inactive."
        confirmLabel="Delete"
        destructive
        pending={pending}
        onConfirm={remove}
      />
    </>
  );
}
