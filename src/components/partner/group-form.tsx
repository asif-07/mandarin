"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Info, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DatePicker } from "@/components/shared/date-picker";
import { createPartnerGroup, updatePartnerGroup, type PartnerGroupInput } from "@/lib/actions/partner-portal";
import { checkSubmission } from "@/lib/workflow/rules";
import { STANDARD_BORDER } from "@/lib/constants";

type Form = { pax_expected: string; travel_date: string; travel_end_date: string; other_border_requested: boolean; entry_port: string; exit_port: string; other_border_note: string; arrival_flight_date: string; arrival_flight_time: string; arrival_flight_no: string; departure_flight_date: string; departure_flight_time: string; departure_flight_no: string; label: string; notes: string };

export function emptyPartnerForm(): Form {
  return { pax_expected: "", travel_date: "", travel_end_date: "", other_border_requested: false, entry_port: STANDARD_BORDER, exit_port: STANDARD_BORDER, other_border_note: "", arrival_flight_date: "", arrival_flight_time: "", arrival_flight_no: "", departure_flight_date: "", departure_flight_time: "", departure_flight_no: "", label: "", notes: "" };
}

/**
 * The partner's group form with the submission rules checked live: standard
 * border unless another is requested, the 4 PM arrival rule, the 2 PM
 * departure rule and the Hong Kong stay reminder.
 */
export function PartnerGroupForm({ groupId, initial }: { groupId?: string; initial?: Form }) {
  const router = useRouter();
  const [form, setForm] = useState<Form>(initial ?? emptyPartnerForm());
  const [pending, startTransition] = useTransition();
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));

  const rules = useMemo(
    () =>
      checkSubmission({
        travel_date: form.travel_date,
        travel_end_date: form.travel_end_date,
        arrival_flight_date: form.arrival_flight_date || null,
        arrival_flight_time: form.arrival_flight_time || null,
        departure_flight_date: form.departure_flight_date || null,
        departure_flight_time: form.departure_flight_time || null,
        entry_port: form.other_border_requested ? form.entry_port : STANDARD_BORDER,
        exit_port: form.other_border_requested ? form.exit_port : STANDARD_BORDER,
        other_border_requested: form.other_border_requested,
      }),
    [form],
  );
  const filled = form.travel_date && form.travel_end_date && Number(form.pax_expected) > 0;
  const showRules = filled && (form.arrival_flight_date || form.departure_flight_date);

  function save() {
    const payload: PartnerGroupInput = { ...form, pax_expected: Number(form.pax_expected) };
    startTransition(async () => {
      const res = groupId ? await updatePartnerGroup(groupId, payload) : await createPartnerGroup(payload);
      if (!res.ok) return void toast.error(res.error);
      toast.success(groupId ? "Group updated" : `Group created · ${(res.data as { group_ref?: string }).group_ref ?? ""}`);
      router.push(`/partner/groups/${res.data.id}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <fieldset disabled={pending} className="grid gap-4 rounded-lg border border-mr-line bg-white p-4 sm:grid-cols-2">
        <p className="micro-label sm:col-span-2">Group</p>
        <div className="space-y-1.5">
          <Label htmlFor="pg_pax">Number of pax</Label>
          <Input id="pg_pax" type="number" inputMode="numeric" min={1} value={form.pax_expected} onChange={(e) => set({ pax_expected: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pg_label">Group label (optional)</Label>
          <Input id="pg_label" value={form.label} onChange={(e) => set({ label: e.target.value })} placeholder="Family group · Mr Ahmed" />
        </div>
        <div className="space-y-1.5">
          <Label>China entry date</Label>
          <DatePicker value={form.travel_date} onChange={(v) => set({ travel_date: v ?? "", travel_end_date: v && form.travel_end_date < v ? v : form.travel_end_date, arrival_flight_date: form.arrival_flight_date || v || "" })} />
        </div>
        <div className="space-y-1.5">
          <Label>China exit date</Label>
          <DatePicker value={form.travel_end_date} onChange={(v) => set({ travel_end_date: v ?? "", departure_flight_date: form.departure_flight_date || v || "" })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pg_entry">Entry port</Label>
          <Input id="pg_entry" value={form.other_border_requested ? form.entry_port : STANDARD_BORDER} readOnly={!form.other_border_requested} className={form.other_border_requested ? "" : "bg-mr-surface"} onChange={(e) => set({ entry_port: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pg_exit">Exit port</Label>
          <Input id="pg_exit" value={form.other_border_requested ? form.exit_port : STANDARD_BORDER} readOnly={!form.other_border_requested} className={form.other_border_requested ? "" : "bg-mr-surface"} onChange={(e) => set({ exit_port: e.target.value })} />
        </div>
        <div className="flex items-start gap-3 rounded-md border border-mr-line bg-mr-surface/60 p-3 sm:col-span-2">
          <Switch id="pg_other" checked={form.other_border_requested} onCheckedChange={(v) => set({ other_border_requested: v, entry_port: v ? "" : STANDARD_BORDER, exit_port: v ? "" : STANDARD_BORDER })} />
          <div className="min-w-0 flex-1">
            <Label htmlFor="pg_other">Request other border</Label>
            <p className="text-xs text-mr-muted">The normal process uses {STANDARD_BORDER} for entry and exit. Another crossing is a separate request that needs company approval and is not treated as a normal submission.</p>
            {form.other_border_requested && <Input className="mt-2" value={form.other_border_note} onChange={(e) => set({ other_border_note: e.target.value })} placeholder="Why another border is needed" />}
          </div>
        </div>
      </fieldset>

      <fieldset disabled={pending} className="grid gap-4 rounded-lg border border-mr-line bg-white p-4 sm:grid-cols-3">
        <p className="micro-label sm:col-span-3">Arrival flight into Hong Kong</p>
        <div className="space-y-1.5">
          <Label>Arrival date</Label>
          <DatePicker value={form.arrival_flight_date} onChange={(v) => set({ arrival_flight_date: v ?? "" })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pg_arr_time">Arrival time</Label>
          <Input id="pg_arr_time" type="time" value={form.arrival_flight_time} onChange={(e) => set({ arrival_flight_time: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pg_arr_no">Flight number (optional)</Label>
          <Input id="pg_arr_no" value={form.arrival_flight_no} onChange={(e) => set({ arrival_flight_no: e.target.value.toUpperCase() })} placeholder="EK 380" />
        </div>
        <p className="micro-label sm:col-span-3">Departure flight from Hong Kong</p>
        <div className="space-y-1.5">
          <Label>Departure date</Label>
          <DatePicker value={form.departure_flight_date} onChange={(v) => set({ departure_flight_date: v ?? "" })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pg_dep_time">Departure time</Label>
          <Input id="pg_dep_time" type="time" value={form.departure_flight_time} onChange={(e) => set({ departure_flight_time: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pg_dep_no">Flight number (optional)</Label>
          <Input id="pg_dep_no" value={form.departure_flight_no} onChange={(e) => set({ departure_flight_no: e.target.value.toUpperCase() })} placeholder="EK 381" />
        </div>
        <div className="space-y-1.5 sm:col-span-3">
          <Label htmlFor="pg_notes">Notes for the company (optional)</Label>
          <Input id="pg_notes" value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
        </div>
      </fieldset>

      {showRules && (rules.blockers.length > 0 || rules.infos.length > 0) && (
        <div className="space-y-2">
          {rules.blockers.map((b) => (
            <p key={b} className="flex gap-2 rounded-md border border-mr-red/40 bg-mr-red/5 p-3 text-sm text-mr-red">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {b}
            </p>
          ))}
          {rules.infos.map((i) => (
            <p key={i} className="flex gap-2 rounded-md border border-mr-line bg-white p-3 text-sm text-mr-body">
              <Info className="mt-0.5 size-4 shrink-0 text-mr-ink" /> {i}
            </p>
          ))}
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button type="button" disabled={pending || !filled} onClick={save}>
          {pending ? <Loader2 className="animate-spin" /> : <Save />} {groupId ? "Save changes" : "Create group"}
        </Button>
      </div>
      <p className="text-xs text-mr-muted">After creating the group you upload the traveller documents (one bulk PDF with passports, PAR, hotel bookings and flight tickets) and then submit. Rules above are checked again on submission.</p>
    </div>
  );
}
