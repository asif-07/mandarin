"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Copy, Link2, Loader2, Pencil, Save, Send, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PassengerCard } from "@/components/apply/passenger-card";
import { applicationCompleteness, checkTransitDates, EXIT_BY_TIME, MAX_STAY_NIGHTS, maxExitDate, MIN_PAX, missingSummary, type ApplicationView, type PassengerView } from "@/lib/apply/shared";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * The application page. `applicant` mode (the private link): trip details,
 * every passenger, add co-passengers or send them personal links, submit.
 * `passenger` mode (a co-passenger's invite link): only their own card.
 */
export function ApplicationPage({ initial, mode }: { initial: ApplicationView; mode: "applicant" | "passenger" }) {
  const router = useRouter();
  const token = initial.token;
  const isApplicant = mode === "applicant";
  const [passengers, setPassengers] = useState<PassengerView[]>(initial.passengers);
  const [open, setOpen] = useState<string | null>(initial.passengers[0]?.id ?? null);
  const [status, setStatus] = useState(initial.status);
  const [submittedAt, setSubmittedAt] = useState(initial.submitted_at);
  const [submitting, setSubmitting] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addGiven, setAddGiven] = useState("");
  const [addSurname, setAddSurname] = useState("");
  const [addBusy, setAddBusy] = useState<"self" | "invite" | null>(null);
  const [newInvite, setNewInvite] = useState<{ name: string; link: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [trip, setTrip] = useState({ contact_name: initial.contact_name, contact_phone: initial.contact_phone ?? "", contact_email: initial.contact_email ?? "", travel_start_date: initial.travel_start_date, travel_end_date: initial.travel_end_date, pax: String(initial.pax ?? initial.passengers.length ?? 1) });
  const [savedTrip, setSavedTrip] = useState(trip);
  const [savingTrip, setSavingTrip] = useState(false);

  const c = applicationCompleteness({ kind: initial.kind, passengers });
  const submitted = status === "submitted" || status === "reviewed";
  const link = typeof window !== "undefined" ? `${window.location.origin}/apply/${isApplicant ? "t" : "p"}/${token}` : "";
  const anyGrouped = !!initial.group_ref || passengers.some((p) => p.grouped);
  const dateProblem = checkTransitDates(trip.travel_start_date, trip.travel_end_date);
  const expectedPax = Number(savedTrip.pax) || passengers.length;

  function upsert(p: PassengerView) {
    setPassengers((ps) => (ps.some((x) => x.id === p.id) ? ps.map((x) => (x.id === p.id ? p : x)) : [...ps, p]));
  }

  async function addPassenger(invite: boolean) {
    if (addGiven.trim().length < 1 || addSurname.trim().length < 1) return void toast.error("Enter the given name and surname");
    setAddBusy(invite ? "invite" : "self");
    try {
      const res = await fetch(`/api/apply/${token}/passengers`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ given_name: addGiven.trim(), surname: addSurname.trim(), invite }) });
      const body = (await res.json().catch(() => ({}))) as { error?: string; passenger?: PassengerView; invite_link?: string | null };
      if (!res.ok || !body.passenger) return void toast.error(body.error ?? "Could not add");
      upsert(body.passenger);
      setAdding(false);
      setAddGiven("");
      setAddSurname("");
      if (invite && body.invite_link) {
        setNewInvite({ name: body.passenger.full_name, link: body.invite_link });
        await navigator.clipboard.writeText(body.invite_link).catch(() => undefined);
      } else setOpen(body.passenger.id);
    } finally {
      setAddBusy(null);
    }
  }

  async function saveTrip() {
    if (dateProblem) return void toast.error(dateProblem);
    setSavingTrip(true);
    try {
      const res = await fetch(`/api/apply/${token}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...trip, pax: Number(trip.pax) || null }) });
      const body = (await res.json().catch(() => ({}))) as { error?: string; datesLocked?: boolean };
      if (!res.ok) return void toast.error(body.error ?? "Could not save");
      if (body.datesLocked) {
        toast.message("The travel dates are fixed by the travel group now; contact us to change them.");
        const kept = { ...trip, travel_start_date: savedTrip.travel_start_date, travel_end_date: savedTrip.travel_end_date };
        setTrip(kept);
        setSavedTrip(kept);
      } else {
        setSavedTrip(trip);
        if (trip.travel_start_date !== savedTrip.travel_start_date || trip.travel_end_date !== savedTrip.travel_end_date) setPassengers((ps) => ps.map((p) => (p.grouped ? p : { ...p, travel_start_date: trip.travel_start_date, travel_end_date: trip.travel_end_date })));
      }
      setEditing(false);
      toast.success("Saved");
      router.refresh();
    } finally {
      setSavingTrip(false);
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
      toast.success(body.ready ? "Submitted. PAR and hotel are in for everyone, so we apply directly." : "Submitted. We will prepare what is missing and contact you.", { duration: 8000 });
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
            <p className="font-heading text-lg font-semibold">{isApplicant ? savedTrip.contact_name : passengers[0]?.full_name}</p>
            <p className="text-sm text-mr-body">
              Entry {formatDate(savedTrip.travel_start_date)} · exit by {formatDate(savedTrip.travel_end_date)} {EXIT_BY_TIME}
              {isApplicant ? ` · ${expectedPax} travelling together` : ` · travelling with ${initial.contact_name}`}
              {initial.group_ref ? ` · group ${initial.group_ref}` : ""}
            </p>
            {isApplicant && expectedPax < MIN_PAX && <p className="mt-1 text-xs text-mr-warning">Minimum {MIN_PAX} pax required for the 144-hour group transit visa. Travelling alone? We match you with another traveller on the same dates.</p>}
            {submitted ? (
              <p className="mt-1 text-sm text-mr-success">
                <CheckCircle2 className="mr-1 inline size-4" />
                Submitted {submittedAt ? formatDateTime(submittedAt) : ""}. {c.ready ? "PAR and hotel are in: we apply directly." : "We prepare what is missing and contact you."} You can still add passengers or documents here.
              </p>
            ) : (
              <p className="mt-1 text-sm text-mr-muted">{isApplicant ? "Not submitted yet. Complete each passenger, then submit." : "Fill in your part below; the main applicant submits the application."}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {isApplicant && (
              <Button type="button" variant="outline" size="sm" onClick={() => setEditing((e) => !e)}>
                <Pencil /> Dates & contact
              </Button>
            )}
            <Button type="button" variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(link).then(() => toast.success("Link copied. Keep it to come back later.")).catch(() => toast.error("Copy failed"))}>
              <Copy /> Copy my link
            </Button>
          </div>
        </div>
        {editing && isApplicant && (
          <div className="mt-4 grid gap-3 border-t border-mr-line pt-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="c_name">Your name</Label>
              <Input id="c_name" value={trip.contact_name} disabled={submitted} onChange={(e) => setTrip({ ...trip, contact_name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c_pax">How many persons travelling together?</Label>
              <Input id="c_pax" type="number" min={1} max={99} value={trip.pax} onChange={(e) => setTrip({ ...trip, pax: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c_phone">Phone</Label>
              <Input id="c_phone" type="tel" value={trip.contact_phone} onChange={(e) => setTrip({ ...trip, contact_phone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c_email">Email</Label>
              <Input id="c_email" type="email" value={trip.contact_email} onChange={(e) => setTrip({ ...trip, contact_email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c_start">Expecting to enter China</Label>
              <Input id="c_start" type="date" disabled={anyGrouped} value={trip.travel_start_date} onChange={(e) => setTrip({ ...trip, travel_start_date: e.target.value, travel_end_date: trip.travel_end_date > maxExitDate(e.target.value) || trip.travel_end_date < e.target.value ? maxExitDate(e.target.value) : trip.travel_end_date })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c_end">Expecting to exit China</Label>
              <Input id="c_end" type="date" disabled={anyGrouped} min={trip.travel_start_date} max={maxExitDate(trip.travel_start_date)} value={trip.travel_end_date} onChange={(e) => setTrip({ ...trip, travel_end_date: e.target.value })} />
            </div>
            <p className={cn("text-xs sm:col-span-2", dateProblem ? "text-mr-red" : "text-mr-muted")}>{dateProblem ?? `Maximum stay ${MAX_STAY_NIGHTS} nights / ${MAX_STAY_NIGHTS + 1} days: exit by ${formatDate(maxExitDate(trip.travel_start_date))}, ${EXIT_BY_TIME}.`}</p>
            {anyGrouped && <p className="text-xs text-mr-muted sm:col-span-2">The dates are fixed by the travel group. Contact us to change them.</p>}
            <div className="sm:col-span-2">
              <Button type="button" size="sm" onClick={saveTrip} disabled={savingTrip || !!dateProblem}>
                {savingTrip ? <Loader2 className="animate-spin" /> : <Save />} Save
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Passengers */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-heading text-base font-semibold">{isApplicant ? (passengers.length > 1 ? "Travellers" : "Your documents") : "Your documents"}</h2>
          {isApplicant && (
            <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)}>
              <UserPlus /> Add co-passenger
            </Button>
          )}
        </div>
        {passengers.map((p, i) => (
          <PassengerCard
            key={p.id}
            token={token}
            kind={initial.kind}
            passenger={p}
            index={i}
            open={open === p.id}
            onToggle={() => setOpen(open === p.id ? null : p.id)}
            onChange={upsert}
            onRemove={() => setPassengers((ps) => ps.filter((x) => x.id !== p.id))}
            canRemove={isApplicant && i > 0}
            canInvite={isApplicant && i > 0}
            alwaysOpen={!isApplicant}
            locked={submitted}
            onSubmit={isApplicant && passengers.length === 1 && c.canSubmit ? submit : undefined}
            submitting={submitting}
            submitLabel={c.ready ? "Apply directly" : "Submit application"}
          />
        ))}
        {isApplicant && passengers.length < expectedPax && (
          <p className="rounded-md border border-dashed border-mr-line px-3 py-2 text-xs text-mr-body">
            {expectedPax - passengers.length} more traveller{expectedPax - passengers.length === 1 ? "" : "s"} to add. Add their passports here yourself, or send each one a personal link to fill in their own details.
          </p>
        )}
      </section>

      {/* Submit (several passengers: one submission for all) */}
      {isApplicant && passengers.length > 1 && (
        <section className={cn("rounded-lg border p-4", c.canSubmit ? "border-mr-ink bg-mr-surface" : "border-mr-line bg-white")}>
          <h2 className="font-heading text-base font-semibold">{submitted ? "Send an update" : "Submit"}</h2>
          {c.canSubmit ? (
            <p className="mt-1 text-sm text-mr-body">{c.ready ? "Everything is in, including PAR and hotel for everyone: we can apply directly." : "Everything needed is in."}</p>
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
            {submitting ? <Loader2 className="animate-spin" /> : <Send />} {submitted ? "Re-send" : c.ready ? "Apply directly" : "Submit application"}
          </Button>
        </section>
      )}

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add a co-passenger</DialogTitle>
            <DialogDescription>Names as in their passport. Upload their documents yourself, or send them a personal link so they fill in their own details.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="add_given">Given name</Label>
              <Input id="add_given" value={addGiven} onChange={(e) => setAddGiven(e.target.value)} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add_surname">Surname</Label>
              <Input id="add_surname" value={addSurname} onChange={(e) => setAddSurname(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="sm:justify-between">
            <Button variant="outline" onClick={() => void addPassenger(true)} disabled={!!addBusy}>
              {addBusy === "invite" ? <Loader2 className="animate-spin" /> : <Link2 />} Send them a link
            </Button>
            <Button onClick={() => void addPassenger(false)} disabled={!!addBusy}>
              {addBusy === "self" ? <Loader2 className="animate-spin" /> : <UserPlus />} I upload for them
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!newInvite} onOpenChange={(o) => !o && setNewInvite(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Personal link for {newInvite?.name}</DialogTitle>
            <DialogDescription>Copied to your clipboard. They open it, upload their passport, photo and PAN card and fill in their details. You stay the main applicant and submit for everyone.</DialogDescription>
          </DialogHeader>
          <p className="break-all rounded-md bg-mr-surface p-2 font-mono text-xs">{newInvite?.link}</p>
          <DialogFooter>
            <a href={`https://wa.me/?text=${encodeURIComponent(`Please fill in your details and upload your passport, photo and PAN card for our China visa: ${newInvite?.link ?? ""}`)}`} target="_blank" rel="noopener" className="text-sm font-medium underline">
              Share on WhatsApp
            </a>
            <Button onClick={() => navigator.clipboard.writeText(newInvite?.link ?? "").then(() => toast.success("Copied")).catch(() => undefined)}>
              <Copy /> Copy again
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
