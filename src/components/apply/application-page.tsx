"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Copy, Loader2, Pencil, Save, Send, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PassengerCard } from "@/components/apply/passenger-card";
import { BulkUpload } from "@/components/apply/bulk-upload";
import { applicationCompleteness, missingSummary, type ApplicationView, type PassengerView } from "@/lib/apply/shared";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/** The application page behind the private link: contact and dates, passengers (one card each), bulk upload for agents, submit. */
export function ApplicationPage({ initial }: { initial: ApplicationView }) {
  const router = useRouter();
  const token = initial.token;
  const isAgent = initial.kind === "b2b";
  const [passengers, setPassengers] = useState<PassengerView[]>(initial.passengers);
  const [open, setOpen] = useState<string | null>(initial.passengers.length === 1 ? initial.passengers[0]!.id : null);
  const [status, setStatus] = useState(initial.status);
  const [submittedAt, setSubmittedAt] = useState(initial.submitted_at);
  const [submitting, setSubmitting] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addName, setAddName] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [contact, setContact] = useState({ contact_name: initial.contact_name, contact_phone: initial.contact_phone ?? "", contact_email: initial.contact_email ?? "", agency_name: initial.agency_name ?? "", travel_start_date: initial.travel_start_date, travel_end_date: initial.travel_end_date });
  const [savedContact, setSavedContact] = useState(contact);
  const [savingContact, setSavingContact] = useState(false);

  const c = applicationCompleteness({ kind: initial.kind, passengers });
  const submitted = status === "submitted" || status === "reviewed";
  const link = typeof window !== "undefined" ? `${window.location.origin}/apply/t/${token}` : `/apply/t/${token}`;
  const anyGrouped = !!initial.group_ref || passengers.some((p) => p.grouped);

  function upsert(p: PassengerView) {
    setPassengers((ps) => (ps.some((x) => x.id === p.id) ? ps.map((x) => (x.id === p.id ? p : x)) : [...ps, p]));
  }

  async function addPassenger() {
    if (addName.trim().length < 2) return;
    setAddBusy(true);
    try {
      const res = await fetch(`/api/apply/${token}/passengers`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ full_name: addName.trim() }) });
      const body = (await res.json().catch(() => ({}))) as { error?: string; passenger?: PassengerView };
      if (!res.ok || !body.passenger) return void toast.error(body.error ?? "Could not add");
      upsert(body.passenger);
      setOpen(body.passenger.id);
      setAdding(false);
      setAddName("");
    } finally {
      setAddBusy(false);
    }
  }

  async function saveContact() {
    setSavingContact(true);
    try {
      const res = await fetch(`/api/apply/${token}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(contact) });
      const body = (await res.json().catch(() => ({}))) as { error?: string; datesLocked?: boolean };
      if (!res.ok) return void toast.error(body.error ?? "Could not save");
      if (body.datesLocked) {
        toast.message("The travel dates are fixed by the travel group now; contact us to change them.");
        setContact((k) => ({ ...k, travel_start_date: savedContact.travel_start_date, travel_end_date: savedContact.travel_end_date }));
        setSavedContact((k) => ({ ...k, ...contact, travel_start_date: k.travel_start_date, travel_end_date: k.travel_end_date }));
      } else {
        setSavedContact(contact);
        if (contact.travel_start_date !== savedContact.travel_start_date || contact.travel_end_date !== savedContact.travel_end_date) setPassengers((ps) => ps.map((p) => (p.grouped ? p : { ...p, travel_start_date: contact.travel_start_date, travel_end_date: contact.travel_end_date })));
      }
      setEditing(false);
      toast.success("Saved");
      router.refresh();
    } finally {
      setSavingContact(false);
    }
  }

  async function submit() {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/apply/${token}/submit`, { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { error?: string; ready?: boolean; submitted_at?: string };
      if (!res.ok) return void toast.error(body.error ?? "Could not submit", { duration: 8000 });
      setStatus("submitted");
      setSubmittedAt(body.submitted_at ?? new Date().toISOString());
      toast.success(body.ready ? "Submitted. PAR and hotel are in for everyone, so we apply directly." : "Submitted. We will prepare the PAR and hotel details and contact you.", { duration: 8000 });
      window.scrollTo({ top: 0, behavior: "smooth" });
      router.refresh();
    } catch {
      toast.error("No connection. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={cn("rounded-lg border p-4", submitted ? "border-mr-success/40 bg-mr-success/5" : "border-mr-line bg-white")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-heading text-lg font-semibold">{isAgent ? savedContact.agency_name || savedContact.contact_name : savedContact.contact_name}</p>
            <p className="text-sm text-mr-body">
              {formatDate(savedContact.travel_start_date)} to {formatDate(savedContact.travel_end_date)} · {passengers.length} passenger{passengers.length === 1 ? "" : "s"}
              {isAgent ? ` · contact ${savedContact.contact_name}` : ""}
              {savedContact.contact_phone ? ` · ${savedContact.contact_phone}` : ""}
              {initial.group_ref ? ` · group ${initial.group_ref}` : ""}
            </p>
            {submitted ? (
              <p className="mt-1 text-sm text-mr-success">
                <CheckCircle2 className="mr-1 inline size-4" />
                Submitted {submittedAt ? formatDateTime(submittedAt) : ""}. {c.ready ? "PAR and hotel are in: we apply directly." : "We prepare the PAR and hotel details and contact you."} You can still add passengers or documents here.
              </p>
            ) : (
              <p className="mt-1 text-sm text-mr-muted">Not submitted yet. {isAgent ? "Upload the group's documents, then submit." : "Complete each passenger, then submit."}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing((e) => !e)}>
              <Pencil /> {isAgent ? "Contact & dates" : "Dates & contact"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(link).then(() => toast.success("Link copied. Keep it to come back later.")).catch(() => toast.error("Copy failed"))}>
              <Copy /> Copy link
            </Button>
          </div>
        </div>
        {editing && (
          <div className="mt-4 grid gap-3 border-t border-mr-line pt-4 sm:grid-cols-2">
            {isAgent && (
              <div className="space-y-1.5">
                <Label htmlFor="c_agency">Agency</Label>
                <Input id="c_agency" value={contact.agency_name} onChange={(e) => setContact({ ...contact, agency_name: e.target.value })} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="c_name">{isAgent ? "Contact person" : "Your name"}</Label>
              <Input id="c_name" value={contact.contact_name} onChange={(e) => setContact({ ...contact, contact_name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c_phone">Phone</Label>
              <Input id="c_phone" type="tel" value={contact.contact_phone} onChange={(e) => setContact({ ...contact, contact_phone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c_email">Email</Label>
              <Input id="c_email" type="email" value={contact.contact_email} onChange={(e) => setContact({ ...contact, contact_email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c_start">Entry into China</Label>
              <Input id="c_start" type="date" disabled={anyGrouped} value={contact.travel_start_date} onChange={(e) => setContact({ ...contact, travel_start_date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c_end">Exit from China</Label>
              <Input id="c_end" type="date" disabled={anyGrouped} min={contact.travel_start_date} value={contact.travel_end_date} onChange={(e) => setContact({ ...contact, travel_end_date: e.target.value })} />
            </div>
            {anyGrouped && <p className="text-xs text-mr-muted sm:col-span-2">The dates are fixed by the travel group. Contact us to change them.</p>}
            <div className="sm:col-span-2">
              <Button type="button" size="sm" onClick={saveContact} disabled={savingContact}>
                {savingContact ? <Loader2 className="animate-spin" /> : <Save />} Save
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Bulk upload for agents */}
      {isAgent && (
        <section className="rounded-lg border border-mr-line bg-white p-4">
          <h2 className="font-heading text-base font-semibold">Bulk upload</h2>
          <p className="mb-3 text-sm text-mr-body">Every passenger needs a passport, a passport photo and a PAN card. PAR, hotel and flight are optional. Drop everything at once.</p>
          <BulkUpload token={token} passengers={passengers} onPassengerAdded={upsert} onPassengerChanged={upsert} />
        </section>
      )}

      {/* Passengers */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-heading text-base font-semibold">{isAgent ? "Passengers" : passengers.length > 1 ? "Travellers" : "Your documents"}</h2>
          <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)}>
            <UserPlus /> {isAgent ? "Add passenger" : "Add co-passenger"}
          </Button>
        </div>
        {passengers.length === 0 && <p className="rounded-lg border border-dashed border-mr-line p-4 text-sm text-mr-muted">No passengers yet. Drop the passports above, or add a passenger by name.</p>}
        {passengers.map((p, i) => (
          <PassengerCard key={p.id} token={token} kind={initial.kind} passenger={p} index={i} open={open === p.id} onToggle={() => setOpen(open === p.id ? null : p.id)} onChange={upsert} onRemove={() => setPassengers((ps) => ps.filter((x) => x.id !== p.id))} canRemove={passengers.length > 1 || isAgent} />
        ))}
        {!isAgent && <p className="text-xs text-mr-muted">Family or friends travelling with you? Add them here with their own passport, photo and PAN card, so you travel as one group.</p>}
      </section>

      {/* Submit */}
      <section className={cn("rounded-lg border p-4", c.canSubmit ? "border-mr-ink bg-mr-surface" : "border-mr-line bg-white")}>
        <h2 className="font-heading text-base font-semibold">{submitted ? "Send an update" : "Submit"}</h2>
        {c.canSubmit ? (
          <p className="mt-1 text-sm text-mr-body">{c.ready ? "Everything is in, including PAR and hotel for everyone: we can apply directly." : "Everything needed is in. We will prepare the PAR and hotel details."}</p>
        ) : passengers.length === 0 ? (
          <p className="mt-1 text-sm text-mr-body">Add at least one passenger.</p>
        ) : (
          <ul className="mt-1 list-inside list-disc text-sm text-mr-body">
            {c.passengers
              .filter((p) => !p.completeness.complete)
              .map((p) => (
                <li key={p.id}>
                  <button type="button" className="underline" onClick={() => setOpen(p.id)}>
                    {p.full_name}
                  </button>
                  : {missingSummary(p.completeness)}
                </li>
              ))}
          </ul>
        )}
        <Button type="button" className="mt-3" onClick={submit} disabled={!c.canSubmit || submitting}>
          {submitting ? <Loader2 className="animate-spin" /> : <Send />} {submitted ? "Re-send" : c.ready ? "Apply directly" : "Submit"}
        </Button>
      </section>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{isAgent ? "Add a passenger" : "Add a co-passenger"}</DialogTitle>
            <DialogDescription>Enter the name as in the passport. You upload their passport, photo and PAN card next.</DialogDescription>
          </DialogHeader>
          <Input value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="Full name" autoFocus onKeyDown={(e) => e.key === "Enter" && void addPassenger()} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button onClick={addPassenger} disabled={addBusy || addName.trim().length < 2}>
              {addBusy && <Loader2 className="animate-spin" />} Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
