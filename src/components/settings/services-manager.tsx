"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Chip } from "@/components/shared/chip";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { deleteService, saveService, type ServiceRow } from "@/lib/actions/services";
import { CURRENCIES, SERVICE_KINDS, labelFor } from "@/lib/constants";
import { formatMoney } from "@/lib/format";

type Draft = { id: string | null; name: string; kind: string; description: string; default_rate: string; currency: string | null; active: boolean; sort: string };

const blank = (): Draft => ({ id: null, name: "", kind: "general", description: "", default_rate: "", currency: null, active: true, sort: "100" });
const fromRow = (r: ServiceRow): Draft => ({ id: r.id, name: r.name, kind: r.kind, description: r.description ?? "", default_rate: r.default_rate === null ? "" : String(r.default_rate), currency: r.currency, active: r.active, sort: String(r.sort) });

/** The Product / Service master: the list every group picks its services from. */
export function ServicesManager({ services }: { services: ServiceRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [removing, setRemoving] = useState<ServiceRow | null>(null);

  function save() {
    if (!draft) return;
    startTransition(async () => {
      const res = await saveService(draft.id, { name: draft.name, kind: draft.kind, description: draft.description, default_rate: draft.default_rate, currency: draft.currency, active: draft.active, sort: Number(draft.sort) || 100 });
      if (!res.ok) return void toast.error(res.error);
      toast.success(draft.id ? "Service updated" : "Service added");
      setDraft(null);
      router.refresh();
    });
  }

  function remove() {
    if (!removing) return;
    startTransition(async () => {
      const res = await deleteService(removing.id);
      setRemoving(null);
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.data.deactivated ? `${removing.name} is in use on groups, so it was deactivated instead of deleted` : `${removing.name} deleted`);
      router.refresh();
    });
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-2">
        <p className="text-sm text-mr-body">Every group picks from this list. An airport transfer asks for from, to, date, pax and transfer mode on the group; those details then flow to the invoice and the transfer voucher.</p>
        <Button type="button" onClick={() => setDraft(blank())}>
          <Plus /> Add service
        </Button>
      </div>
      {services.length === 0 ? (
        <p className="rounded-lg border border-dashed border-mr-line px-4 py-6 text-center text-sm text-mr-muted">No services yet.</p>
      ) : (
        <ul className="divide-y divide-mr-line rounded-lg border border-mr-line bg-white">
          {services.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-mr-ink">
                  {s.name}
                  <Chip tone={s.kind === "airport_transfer" ? "ink" : "neutral"}>{labelFor(SERVICE_KINDS, s.kind)}</Chip>
                  {!s.active && <Chip tone="muted">Inactive</Chip>}
                </p>
                {s.description && <p className="truncate text-xs text-mr-muted">{s.description}</p>}
              </div>
              <span className="tnum text-sm text-mr-body">{s.default_rate !== null && s.currency ? formatMoney(s.default_rate, s.currency) : s.default_rate !== null ? String(s.default_rate) : ""}</span>
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`Edit ${s.name}`} onClick={() => setDraft(fromRow(s))}>
                <Pencil />
              </Button>
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`Delete ${s.name}`} onClick={() => setRemoving(s)}>
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!draft} onOpenChange={(o) => !o && !pending && setDraft(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit service" : "New service"}</DialogTitle>
            <DialogDescription>The name is printed on invoices exactly as entered here.</DialogDescription>
          </DialogHeader>
          {draft && (
            <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="svc_name">Name</Label>
                <Input id="svc_name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Airport Transfer" autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="svc_kind">Kind</Label>
                <Select value={draft.kind} onValueChange={(v) => setDraft({ ...draft, kind: v })}>
                  <SelectTrigger id="svc_kind" className="w-full rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_KINDS.map((k) => (
                      <SelectItem key={k.value} value={k.value}>
                        {k.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-mr-muted">{draft.kind === "airport_transfer" ? "Groups ask for from, to, date, pax and mode; a transfer voucher can be printed." : "Groups ask for a note, quantity and rate."}</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="svc_sort">Order</Label>
                <Input id="svc_sort" type="number" inputMode="numeric" value={draft.sort} onChange={(e) => setDraft({ ...draft, sort: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="svc_rate">Default rate (optional)</Label>
                <Input id="svc_rate" type="number" inputMode="decimal" min={0} step="0.01" value={draft.default_rate} onChange={(e) => setDraft({ ...draft, default_rate: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="svc_currency">Currency</Label>
                <Select value={draft.currency ?? "none"} onValueChange={(v) => setDraft({ ...draft, currency: v === "none" ? null : v })}>
                  <SelectTrigger id="svc_currency" className="w-full rounded-lg">
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Any</SelectItem>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="svc_desc">Description (optional)</Label>
                <Input id="svc_desc" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
              </div>
              <div className="flex items-center gap-2 sm:col-span-2">
                <Switch id="svc_active" checked={draft.active} onCheckedChange={(v) => setDraft({ ...draft, active: v })} />
                <Label htmlFor="svc_active">Active (shown when adding services to a group)</Label>
              </div>
            </fieldset>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button type="button" disabled={pending || !draft?.name.trim()} onClick={save}>
              {pending && <Loader2 className="animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Delete ${removing?.name ?? "this service"}?`}
        description="A service already used on a group is deactivated instead, so those groups keep their details."
        confirmLabel="Delete"
        destructive
        pending={pending}
        onConfirm={remove}
      />
    </>
  );
}
