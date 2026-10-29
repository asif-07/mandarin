"use client";

import { useState } from "react";
import { ChevronDown, Link2, Loader2, Save, ScanLine, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { DocSlot } from "@/components/apply/doc-slot";
import { readPanNumber, readPassportMrz } from "@/components/apply/passport-ocr";
import { missingSummary, passengerCompleteness, PORTAL_DOCS, type ApplicantDoc, type ApplicationKind, type PassengerView } from "@/lib/apply/shared";
import { nationalityLabel, type MrzResult } from "@/lib/apply/mrz";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type Details = Pick<PassengerView, "given_name" | "surname" | "phone" | "email" | "nationality" | "passport_number" | "date_of_birth" | "sex" | "passport_expiry" | "address" | "pan_number" | "par_answer">;
const KEYS: (keyof Details)[] = ["given_name", "surname", "phone", "email", "nationality", "passport_number", "date_of_birth", "sex", "passport_expiry", "address", "pan_number", "par_answer"];
function pick(p: PassengerView): Details {
  return Object.fromEntries(KEYS.map((k) => [k, p[k] ?? ""])) as unknown as Details;
}

/** Save a passenger's details through the portal API; returns the stored passenger. */
export async function savePassengerDetails(token: string, travellerId: string, details: Partial<Details> & { passport_ocr?: unknown }): Promise<PassengerView> {
  const res = await fetch(`/api/apply/${token}/passengers/${travellerId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(details) });
  const body = (await res.json().catch(() => ({}))) as { error?: string; passenger?: PassengerView };
  if (!res.ok || !body.passenger) throw new Error(body.error ?? "Could not save");
  return body.passenger;
}

const spec = (type: string) => PORTAL_DOCS.find((d) => d.type === type)!;

/**
 * One passenger, in the order the application works: passport front and
 * back (read by OCR), the Hong Kong PAR question, the details, photo and
 * PAN card (PAN number read from the card), optional hotel and flight.
 */
export function PassengerCard({ token, kind, passenger, index, open, onToggle, onChange, onRemove, canRemove, canInvite, alwaysOpen = false }: { token: string; kind: ApplicationKind; passenger: PassengerView; index: number; open: boolean; onToggle: () => void; onChange: (p: PassengerView) => void; onRemove: () => void; canRemove: boolean; canInvite?: boolean; alwaysOpen?: boolean }) {
  const [details, setDetails] = useState<Details>(() => pick(passenger));
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(passenger.invite_token && typeof window !== "undefined" ? `${window.location.origin}/apply/p/${passenger.invite_token}` : null);
  const [ocr, setOcr] = useState<{ label: string; pct: number } | null>(null);
  const [ocrResult, setOcrResult] = useState<MrzResult | null>(null);
  const [ocrPending, setOcrPending] = useState<MrzResult | null>(null);
  const savedDetails = pick(passenger);
  const dirty = KEYS.some((k) => (details[k] ?? "") !== (savedDetails[k] ?? ""));
  const c = passengerCompleteness({ ...passenger, ...details, documents: passenger.documents }, kind);
  const present = new Set(passenger.documents.map((d) => d.doc_type));
  const passportIn = present.has("passport") && present.has("passport_back");
  const isOpen = alwaysOpen || open;

  function set<K extends keyof Details>(k: K, v: Details[K]) {
    setDetails((d) => ({ ...d, [k]: v }));
  }
  function docUploaded(doc: ApplicantDoc) {
    onChange({ ...passenger, documents: [...passenger.documents.filter((d) => d.doc_type !== doc.doc_type), doc] });
  }
  function docRemoved(id: string) {
    onChange({ ...passenger, documents: passenger.documents.filter((d) => d.id !== id) });
  }

  async function runOcr(file: File) {
    setOcr({ label: "Preparing", pct: 2 });
    setOcrResult(null);
    try {
      const result = await readPassportMrz(file, (label, pct) => setOcr({ label, pct }));
      if (!result) return void toast.message(file.type === "application/pdf" ? "PDF uploaded. Please type the passport details." : "Could not read the passport automatically. Please type the details.", { duration: 6000 });
      setOcrResult(result);
      setOcrPending(result);
    } catch (e) {
      toast.message(`Passport reading is not available (${e instanceof Error ? e.message : "error"}). Please type the details.`);
    } finally {
      setOcr(null);
    }
  }

  async function runPanOcr(file: File) {
    if (details.pan_number) return;
    setOcr({ label: "Reading PAN card", pct: 10 });
    try {
      const pan = await readPanNumber(file, (label, pct) => setOcr({ label, pct }));
      if (pan) {
        set("pan_number", pan);
        toast.success(`PAN number read from the card: ${pan}. Please check and save.`);
      } else toast.message("Could not read the PAN number from the card. Please type it.");
    } catch {
      /* typing is the fallback */
    } finally {
      setOcr(null);
    }
  }

  function applyOcr(r: MrzResult) {
    setDetails((d) => ({
      ...d,
      given_name: r.given_names || d.given_name,
      surname: r.surname || d.surname,
      passport_number: r.passport_number || d.passport_number,
      nationality: r.nationality ? nationalityLabel(r.nationality) : d.nationality,
      date_of_birth: r.date_of_birth ?? d.date_of_birth,
      sex: r.sex ?? d.sex,
      passport_expiry: r.expiry ?? d.passport_expiry,
    }));
    setOcrPending(null);
    toast.success("Passport details filled in. Check them and save.");
  }

  async function save(extra: Partial<Details> = {}) {
    setSaving(true);
    try {
      const next = { ...details, ...extra };
      const p = await savePassengerDetails(token, passenger.id, { ...next, passport_ocr: ocrResult ? { ...ocrResult, read_at: new Date().toISOString() } : undefined });
      onChange(p);
      setDetails(pick(p));
      toast.success("Saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function answerPar(answer: "has_par" | "needs_par") {
    set("par_answer", answer);
    if (!details.given_name) return; // saved together with the details later
    await save({ par_answer: answer });
  }

  async function remove() {
    if (!confirm(`Remove ${passenger.full_name} from this application?`)) return;
    setRemoving(true);
    try {
      const res = await fetch(`/api/apply/${token}/passengers/${passenger.id}`, { method: "DELETE" });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) return void toast.error(body.error ?? "Could not remove");
      onRemove();
    } finally {
      setRemoving(false);
    }
  }

  async function invite() {
    setInviting(true);
    try {
      const res = await fetch(`/api/apply/${token}/passengers/${passenger.id}/invite`, { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { error?: string; link?: string };
      if (!res.ok || !body.link) return void toast.error(body.error ?? "Could not create the link");
      setInviteLink(body.link);
      await navigator.clipboard.writeText(body.link).catch(() => undefined);
      toast.success("Personal link copied. Send it to them: they fill in their own details and upload their documents.");
    } finally {
      setInviting(false);
    }
  }

  return (
    <div className={cn("rounded-lg border bg-white", c.complete ? "border-mr-success/40" : "border-mr-line")}>
      {!alwaysOpen && (
        <button type="button" onClick={onToggle} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left" aria-expanded={open}>
          <span className="flex size-6 items-center justify-center rounded-full bg-mr-ink text-xs font-semibold text-white">{index + 1}</span>
          <span className="font-medium text-mr-ink">{passenger.full_name}</span>
          {passenger.passport_number && <span className="font-mono text-xs text-mr-muted">{passenger.passport_number}</span>}
          <span className={cn("ml-auto text-xs", c.complete ? "text-mr-success" : "text-mr-warning")}>{c.complete ? (c.ready ? "Complete · PAR + hotel in" : "Complete") : `Missing: ${missingSummary(c)}`}</span>
          <ChevronDown className={cn("size-4 text-mr-muted transition-transform", open && "rotate-180")} />
        </button>
      )}
      {isOpen && (
        <div className={cn("space-y-5 px-4 py-4", !alwaysOpen && "border-t border-mr-line")}>
          {/* 1. Passport front + back */}
          <section>
            <h3 className="mb-1 text-sm font-semibold">1. Passport (front and back)</h3>
            <p className="mb-2 text-xs text-mr-muted">Clear photos of the data page and the back page. The details are read from the front page; nothing is sent anywhere for that.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <DocSlot token={token} travellerId={passenger.id} spec={spec("passport")} doc={passenger.documents.find((d) => d.doc_type === "passport")} onUploaded={docUploaded} onRemoved={docRemoved} onUploadedFile={(f) => void runOcr(f)} />
              <DocSlot token={token} travellerId={passenger.id} spec={spec("passport_back")} doc={passenger.documents.find((d) => d.doc_type === "passport_back")} onUploaded={docUploaded} onRemoved={docRemoved} />
            </div>
            {ocr && (
              <div className="mt-3 flex items-center gap-3 text-sm text-mr-body">
                <ScanLine className="size-4 animate-pulse" /> {ocr.label}… <Progress value={ocr.pct} className="h-1.5 w-40" />
              </div>
            )}
            {ocrPending && (
              <div className="mt-3 rounded-md border border-mr-ink bg-mr-surface p-3 text-sm">
                <p className="font-medium text-mr-ink">We read the passport{ocrPending.valid ? "" : " (some characters were unclear, please check carefully)"}:</p>
                <p className="mt-1 text-mr-body">
                  {ocrPending.given_names} {ocrPending.surname} · {ocrPending.passport_number} · {nationalityLabel(ocrPending.nationality)} · born {ocrPending.date_of_birth ? formatDate(ocrPending.date_of_birth) : "?"} · {ocrPending.sex ?? "?"} · expires {ocrPending.expiry ? formatDate(ocrPending.expiry) : "?"}
                </p>
                <div className="mt-2 flex gap-2">
                  <Button type="button" size="sm" onClick={() => applyOcr(ocrPending)}>
                    Use these details
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setOcrPending(null)}>
                    Type them instead
                  </Button>
                </div>
              </div>
            )}
            {present.has("passport") && !ocr && !ocrPending && (
              <label className="mt-2 inline-flex cursor-pointer items-center gap-1 text-xs text-mr-body hover:text-mr-ink">
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && void runOcr(e.target.files[0])} />
                <ScanLine className="size-3" /> Read the details again from a photo (without uploading)
              </label>
            )}
          </section>

          {/* 2. PAR question */}
          <section className={cn("rounded-md border p-3", passportIn ? "border-mr-ink/30 bg-mr-surface" : "border-mr-line")}>
            <h3 className="text-sm font-semibold">2. Do you have the Hong Kong Pre-Arrival Registration (PAR)?</h3>
            <p className="mb-2 text-xs text-mr-muted">{passportIn ? "Choose one." : "Upload the passport first, then answer here."}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={() => void answerPar("has_par")} className={cn("rounded-md border p-2.5 text-left text-sm", details.par_answer === "has_par" ? "border-mr-ink bg-white" : "border-mr-line bg-white hover:bg-mr-surface")} aria-pressed={details.par_answer === "has_par"}>
                <span className="block font-medium text-mr-ink">Yes, I have the PAR</span>
                <span className="block text-xs text-mr-muted">Upload it below.</span>
              </button>
              <button type="button" onClick={() => void answerPar("needs_par")} className={cn("rounded-md border p-2.5 text-left text-sm", details.par_answer === "needs_par" ? "border-mr-ink bg-white" : "border-mr-line bg-white hover:bg-mr-surface")} aria-pressed={details.par_answer === "needs_par"}>
                <span className="block font-medium text-mr-ink">No, I do not have it</span>
                <span className="block text-xs text-mr-muted">We apply for the PAR for you; our PAR team is informed.</span>
              </button>
            </div>
            {details.par_answer === "has_par" && (
              <div className="mt-3">
                <DocSlot token={token} travellerId={passenger.id} spec={spec("par")} doc={passenger.documents.find((d) => d.doc_type === "par")} onUploaded={docUploaded} onRemoved={docRemoved} compact />
              </div>
            )}
            {details.par_answer === "needs_par" && <p className="mt-2 text-xs text-mr-success">Noted: we will apply for the PAR{details.given_name ? "" : " once the details below are saved"}.</p>}
          </section>

          {/* 3. Details */}
          <section>
            <h3 className="mb-2 text-sm font-semibold">3. Details</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Given name (as in passport) *" id={`gn-${passenger.id}`}>
                <Input id={`gn-${passenger.id}`} value={details.given_name ?? ""} onChange={(e) => set("given_name", e.target.value)} />
              </Field>
              <Field label="Surname (as in passport) *" id={`sn-${passenger.id}`}>
                <Input id={`sn-${passenger.id}`} value={details.surname ?? ""} onChange={(e) => set("surname", e.target.value)} />
              </Field>
              <Field label="Passport number *" id={`pn-${passenger.id}`}>
                <Input id={`pn-${passenger.id}`} className="uppercase" autoCapitalize="characters" value={details.passport_number ?? ""} onChange={(e) => set("passport_number", e.target.value.toUpperCase())} />
              </Field>
              <Field label="Nationality" id={`na-${passenger.id}`}>
                <Input id={`na-${passenger.id}`} value={details.nationality ?? ""} onChange={(e) => set("nationality", e.target.value)} />
              </Field>
              <Field label="Date of birth" id={`dob-${passenger.id}`}>
                <Input id={`dob-${passenger.id}`} type="date" value={details.date_of_birth ?? ""} onChange={(e) => set("date_of_birth", e.target.value)} />
              </Field>
              <Field label="Sex" id={`sx-${passenger.id}`}>
                <Select value={details.sex || "none"} onValueChange={(v) => set("sex", v === "none" ? "" : v)}>
                  <SelectTrigger id={`sx-${passenger.id}`} className="w-full">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    <SelectItem value="M">Male</SelectItem>
                    <SelectItem value="F">Female</SelectItem>
                    <SelectItem value="X">Other / X</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Passport expiry" id={`ex-${passenger.id}`}>
                <Input id={`ex-${passenger.id}`} type="date" value={details.passport_expiry ?? ""} onChange={(e) => set("passport_expiry", e.target.value)} />
              </Field>
              <Field label="PAN number *" id={`pan-${passenger.id}`}>
                <Input id={`pan-${passenger.id}`} className="uppercase" placeholder="ABCDE1234F" autoCapitalize="characters" value={details.pan_number ?? ""} onChange={(e) => set("pan_number", e.target.value.toUpperCase())} />
              </Field>
              <Field label="Address *" id={`ad-${passenger.id}`} className="sm:col-span-2">
                <Textarea id={`ad-${passenger.id}`} rows={2} value={details.address ?? ""} onChange={(e) => set("address", e.target.value)} placeholder="House / flat, street, city, country" />
              </Field>
              <Field label="Phone (WhatsApp)" id={`ph-${passenger.id}`}>
                <Input id={`ph-${passenger.id}`} type="tel" value={details.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
              </Field>
              <Field label="Email" id={`em-${passenger.id}`}>
                <Input id={`em-${passenger.id}`} type="email" value={details.email ?? ""} onChange={(e) => set("email", e.target.value)} />
              </Field>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Button type="button" size="sm" onClick={() => void save()} disabled={!dirty || saving}>
                {saving ? <Loader2 className="animate-spin" /> : <Save />} Save details
              </Button>
              {dirty && <span className="text-xs text-mr-warning">Unsaved changes</span>}
            </div>
          </section>

          {/* 4. Photo + PAN */}
          <section>
            <h3 className="mb-2 text-sm font-semibold">4. Passport photo and PAN card</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <DocSlot token={token} travellerId={passenger.id} spec={spec("photo")} doc={passenger.documents.find((d) => d.doc_type === "photo")} onUploaded={docUploaded} onRemoved={docRemoved} />
              <DocSlot token={token} travellerId={passenger.id} spec={spec("pan_card")} doc={passenger.documents.find((d) => d.doc_type === "pan_card")} onUploaded={docUploaded} onRemoved={docRemoved} onUploadedFile={(f) => void runPanOcr(f)} />
            </div>
          </section>

          {/* 5. Optional */}
          <section>
            <h3 className="mb-1 text-sm font-semibold">5. Hotel and flight (optional)</h3>
            <p className="mb-2 text-xs text-mr-muted">If already booked. With PAR and hotel booking in, we apply for the visa directly.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <DocSlot token={token} travellerId={passenger.id} spec={spec("hotel_booking")} doc={passenger.documents.find((d) => d.doc_type === "hotel_booking")} onUploaded={docUploaded} onRemoved={docRemoved} compact />
              <DocSlot token={token} travellerId={passenger.id} spec={spec("flight_ticket")} doc={passenger.documents.find((d) => d.doc_type === "flight_ticket")} onUploaded={docUploaded} onRemoved={docRemoved} compact />
            </div>
          </section>

          {(canInvite || canRemove) && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-mr-line pt-3">
              {canInvite ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={invite} disabled={inviting}>
                    {inviting ? <Loader2 className="animate-spin" /> : <Link2 />} {inviteLink ? "Copy their personal link" : "Let them fill in their own details"}
                  </Button>
                  {inviteLink && (
                    <a href={`https://wa.me/?text=${encodeURIComponent(`Please fill in your details and upload your passport, photo and PAN card for our China visa: ${inviteLink}`)}`} target="_blank" rel="noopener" className="text-xs font-medium text-mr-body underline">
                      Share on WhatsApp
                    </a>
                  )}
                </div>
              ) : (
                <span />
              )}
              {canRemove && (
                <Button type="button" variant="ghost" size="sm" className="text-mr-red" onClick={remove} disabled={removing || passenger.grouped} title={passenger.grouped ? "Already placed in a travel group" : undefined}>
                  {removing ? <Loader2 className="animate-spin" /> : <Trash2 />} Remove
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, id, className, children }: { label: string; id: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
