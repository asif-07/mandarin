"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Ticket } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/shared/date-picker";
import { issueTransferVoucher } from "@/lib/actions/transfer-vouchers";
import { TRANSFER_MODES } from "@/lib/constants";

export type VoucherDefaults = { group_service_id?: string | null; from_place: string; to_place: string; transfer_date: string; pax: number | null; transfer_mode: string | null; notes: string };
type VoucherForm = Omit<VoucherDefaults, "pax"> & { pax: string };

/**
 * Create a transfer voucher from a group. The group's details are pulled in
 * and the route stays editable (Hong Kong airport to Guangzhou, Foshan or
 * elsewhere). Issuing generates the voucher number and its unique QR token.
 */
export function IssueVoucherButton({ groupId, groupRef, defaults, label = "Create transfer voucher", size = "xs", variant = "outline" }: { groupId: string; groupRef: string; defaults: VoucherDefaults; label?: string; size?: "xs" | "sm"; variant?: "outline" | "default" | "ghost" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<VoucherForm>({ ...defaults, pax: defaults.pax ? String(defaults.pax) : "" });
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const res = await issueTransferVoucher({ group_id: groupId, group_service_id: form.group_service_id ?? null, from_place: form.from_place, to_place: form.to_place, transfer_date: form.transfer_date, pax: Number(form.pax), transfer_mode: form.transfer_mode, notes: form.notes });
      if (!res.ok) return void toast.error(res.error);
      toast.success(`${res.data.voucher_no} issued`, { description: "Download the PDF from the group card and send it to the customer." });
      setOpen(false);
      router.refresh();
      window.open(`/api/vouchers/${res.data.id}/pdf`, "_blank", "noopener");
    });
  }

  const valid = form.from_place.trim() && form.to_place.trim() && /^\d{4}-\d{2}-\d{2}$/.test(form.transfer_date) && Number(form.pax) > 0;

  return (
    <>
      <Button type="button" variant={variant} size={size} onClick={() => (setForm({ ...defaults, pax: defaults.pax ? String(defaults.pax) : "" }), setOpen(true))}>
        <Ticket /> {label}
      </Button>
      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Transfer voucher · {groupRef}</DialogTitle>
            <DialogDescription>Pulled from the group. Adjust the route if it differs; the voucher number and a unique QR code are generated on issue.</DialogDescription>
          </DialogHeader>
          <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="tv_from">From</Label>
              <Input id="tv_from" value={form.from_place} onChange={(e) => setForm({ ...form, from_place: e.target.value })} placeholder="Hong Kong International Airport" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="tv_to">To</Label>
              <Input id="tv_to" value={form.to_place} onChange={(e) => setForm({ ...form, to_place: e.target.value })} placeholder="Guangzhou / Foshan / …" />
            </div>
            <div className="space-y-1.5">
              <Label>Transfer date</Label>
              <DatePicker value={form.transfer_date} onChange={(v) => setForm({ ...form, transfer_date: v ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tv_pax">Passengers</Label>
              <Input id="tv_pax" type="number" inputMode="numeric" min={1} value={form.pax} onChange={(e) => setForm({ ...form, pax: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tv_mode">Transfer type</Label>
              <Select value={form.transfer_mode ?? ""} onValueChange={(v) => setForm({ ...form, transfer_mode: v })}>
                <SelectTrigger id="tv_mode" className="w-full rounded-lg">
                  <SelectValue placeholder="Choose…" />
                </SelectTrigger>
                <SelectContent>
                  {TRANSFER_MODES.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tv_notes">Notes (optional)</Label>
              <Input id="tv_notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Flight, meeting point…" />
            </div>
          </fieldset>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={pending || !valid} onClick={submit}>
              {pending && <Loader2 className="animate-spin" />} Issue voucher
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
