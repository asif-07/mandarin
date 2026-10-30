"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronDown, Link2, Loader2, Lock, Save, ScanLine, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { DocSlot, type UploadedDoc } from "@/components/apply/doc-slot";
import { canReadLocally, fetchStoredImage, readPanNumber, readPassportMrz } from "@/components/apply/passport-ocr";
import { missingSummary, passengerCompleteness, PORTAL_DOCS, portalDocLabel, type ApplicantDoc, type ApplicationKind, type PassengerView } from "@/lib/apply/shared";
import { nationalityLabel, type MrzResult } from "@/lib/apply/mrz";
import { formatDate, formatDateTime } from "@/lib/format";
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
const STEPS = ["Passport", "PAR", "Details", "Photo & PAN", "Review"] as const;

/**
 * One passenger as a step-by-step wizard: 1 passport front and back (read
 * by OCR) and the PAR question, 2 PAR upload (or "we apply"), 3 details,
 * 4 photo, PAN card, flight and hotel, 5 review and submit. Each step is
 * unlocked by the previous one; everything stays editable later except the
 * name once the application is submitted.
 */
export function PassengerCard({ token, kind, passenger, index, open, onToggle, onChange, onRemove, canRemove, canInvite, alwaysOpen = false, locked = false, onSubmit, submitting = false, submitLabel }: { token: string; kind: ApplicationKind; passenger: PassengerView; index: number; open: boolean; onToggle: () => void; onChange: (p: PassengerView) => void; onRemove: () => void; canRemove: boolean; canInvite?: boolean; alwaysOpen?: boolean; locked?: boolean; onSubmit?: () => void; submitting?: boolean; submitLabel?: string }) {
  const [details, setDetails] = useState<Details>(() => pick(passenger));
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(passenger.invite_token && typeof window !== "undefined" ? `${window.location.origin}/apply/p/${passenger.invite_token}` : null);
  const [ocr, setOcr] = useState<{ label: string; pct: number } | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<MrzResult | null>(null);
  const [ocrPending, setOcrPending] = useState<MrzResult | null>(null);
  const savedDetails = pick(passenger);
  const dirty = KEYS.some((k) => (details[k] ?? "") !== (savedDetails[k] ?? ""));
  const c = passengerCompleteness({ ...passenger, documents: passenger.documents }, kind);
  const present = new Set(passenger.documents.map((d) => d.doc_type));
  const doc = (type: string) => passenger.documents.find((d) => d.doc_type === type);
  const passportIn = present.has("passport") && present.has("passport_back");
  const parAnswer = passenger.par_answer;
  const parDone = parAnswer === "needs_par" || (parAnswer === "has_par" && present.has("par"));
  const detailsDone = !!passenger.given_name && !!passenger.passport_number && (kind === "b2b" || !!passenger.address) && !!passenger.pan_number;
  const photosDone = present.has("photo") && present.has("pan_card");
  const stepDone = [passportIn, parDone, detailsDone, photosDone, c.complete];
  // Start at the first unfinished step (a returning visitor lands where they left off).
  const [step, setStep] = useState(() => Math.max(0, stepDone.findIndex((d) => !d)) || (stepDone.every(Boolean) ? 4 : 0));
  const isOpen = alwaysOpen || open;
  const canNext = step < 4 && stepDone[step];

  function set<K extends keyof Details>(k: K, v: Details[K]) {
    setDetails((d) => ({ ...d, [k]: v }));
  }
  function docUploaded(d: UploadedDoc) {
    const next: PassengerView = { ...passenger, documents: [...passenger.documents.filter((x) => x.doc_type !== d.doc_type), d], par_answer: d.par_answer ?? passenger.par_answer };
    onChange(next);
    if (d.par_answer) set("par_answer", d.par_answer);
  }
  function docRemoved(id: string) {
    onChange({ ...passenger, documents: passenger.documents.filter((d) => d.id !== id) });
  }

  async function runOcr(file: File | null, storedUrl?: string | null) {
    setOcr({ label: "Preparing", pct: 1 });
    setOcrError(null);
    setOcrResult(null);
    setOcrPending(null);
    try {
      let src: Blob | null = file && canReadLocally(file) ? file : null;
      if (!src && storedUrl) {
        setOcr({ label: "Fetching the uploaded image", pct: 2 });
        src = await fetchStoredImage(storedUrl);
      }
      if (!src) {
        setOcrError(file?.type === "application/pdf" ? "A PDF cannot be read here. You can type the passport details in step 3." : "This photo format cannot be read here. You can type the passport details in step 3.");
        return;
      }
      const result = await readPassportMrz(src, (label, pct) => setOcr({ label, pct }));
      if (!result) {
        setOcrError("Could not find the two machine-readable lines at the bottom of the passport. Take the photo straight, with the whole page in frame and no glare, and try again. Or type the details in step 3.");
        return;
      }
      setOcrResult(result);
      setOcrPending(result);
    } catch (e) {
      setOcrError(`Passport reading failed: ${e instanceof Error ? e.message : "unknown error"}. Check the connection and try again, or type the details in step 3.`);
    } finally {
      setOcr(null);
    }
  }

  async function runPanOcr(file: File, storedUrl?: string | null) {
    if (details.pan_number) return;
    setOcr({ label: "Reading PAN card", pct: 5 });
    try {
      const src: Blob | null = canReadLocally(file) ? file : storedUrl ? await fetchStoredImage(storedUrl).catch(() => null) : null;
      if (!src) return;
      const pan = await readPanNumber(src, (label, pct) => setOcr({ label, pct }));
      if (pan) {
        set("pan_number", pan);
        await save({ pan_number: pan });
        toast.success(`PAN number read from the card: ${pan}. Check it in step 3 if needed.`);
      } else toast.message("Could not read the PAN number from the card. Please type it in step 3.");
    } catch {
      /* typing is the fallback */
    } finally {
      setOcr(null);
    }
  }

  function applyOcr(r: MrzResult) {
    const next: Partial<Details> = {
      given_name: locked ? details.given_name : r.given_names || details.given_name,
      surname: locked ? details.surname : r.surname || details.surname,
      passport_number: r.passport_number || details.passport_number,
      nationality: r.nationality ? nationalityLabel(r.nationality) : details.nationality,
      date_of_birth: r.date_of_birth ?? details.date_of_birth,
      sex: r.sex ?? details.sex,
      passport_expiry: r.expiry ?? details.passport_expiry,
    };
    setDetails((d) => ({ ...d, ...next }));
    setOcrPending(null);
    void save(next, "Passport details filled in from the scan. Check them in step 3.");
  }

  async function save(extra: Partial<Details> = {}, message = "Saved") {
    setSaving(true);
    try {
      const next = { ...details, ...extra };
      const p = await savePassengerDetails(token, passenger.id, { ...next, passport_ocr: ocrResult ? { ...ocrResult, read_at: new Date().toISOString() } : undefined });
      onChange(p);
      setDetails(pick(p));
      toast.success(message);
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function answerPar(answer: "has_par" | "needs_par") {
    set("par_answer", answer);
    const ok = await save({ par_answer: answer }, answer === "needs_par" ? "Noted. Our team is informed and will apply for your PAR." : "Noted. Upload the PAR in the next step.");
    if (ok) setStep(1);
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

  const slot = (type: string, extra: Partial<Parameters<typeof DocSlot>[0]> = {}) => <DocSlot token={token} travellerId={passenger.id} spec={spec(type)} doc={doc(type)} onUploaded={docUploaded} onRemoved={docRemoved} locked={locked} {...extra} />;

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
        <div className={cn("px-4 py-4", !alwaysOpen && "border-t border-mr-line")}>
          {/* Stepper */}
          <ol className="mb-4 grid grid-cols-5 gap-1 text-center text-[11px] sm:text-xs">
            {STEPS.map((label, i) => (
              <li key={label}>
                <button type="button" onClick={() => (i <= step || stepDone.slice(0, i).every(Boolean)) && setStep(i)} className={cn("w-full rounded-md border px-1 py-1.5", i === step ? "border-mr-ink bg-mr-ink text-white" : stepDone[i] ? "border-mr-success/40 bg-mr-success/10 text-mr-success" : "border-mr-line text-mr-muted")} aria-current={i === step ? "step" : undefined}>
                  {stepDone[i] && i !== step ? <Check className="mr-0.5 inline size-3" /> : null}
                  {i + 1}. {label}
                </button>
              </li>
            ))}
          </ol>

          {step === 0 && (
            <section className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold">Upload the passport: front (data page) and back (address page)</h3>
                <p className="mb-2 text-xs text-mr-muted">Clear photos, whole page in frame. The details are read from the front page on this device.</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {slot("passport", { onUploadedFile: (f, d) => void runOcr(f, d.preview_url) })}
                  {slot("passport_back")}
                </div>
                {ocr && (
                  <div className="mt-3 rounded-md border border-mr-line bg-mr-surface p-3 text-sm text-mr-body">
                    <div className="flex items-center gap-3">
                      <ScanLine className="size-4 animate-pulse" /> {ocr.label}… <Progress value={ocr.pct} className="h-1.5 w-40" />
                    </div>
                    <p className="mt-1 text-xs text-mr-muted">The first read downloads the reader (about 15 MB) once; later reads are quick. Keep this page open.</p>
                  </div>
                )}
                {ocrError && !ocr && (
                  <div className="mt-3 rounded-md border border-mr-warning/40 bg-mr-warning/5 p-3 text-sm text-mr-body">
                    <p>{ocrError}</p>
                    {present.has("passport") && (
                      <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => void runOcr(null, doc("passport")?.preview_url ?? null)}>
                        <ScanLine /> Try reading again
                      </Button>
                    )}
                  </div>
                )}
                {ocrPending && (
                  <div className="mt-3 rounded-md border border-mr-ink bg-mr-surface p-3 text-sm">
                    <p className="font-medium text-mr-ink">We read the passport{ocrPending.valid ? "" : " (some characters were unclear, please check carefully)"}:</p>
                    <p className="mt-1 text-mr-body">
                      {ocrPending.given_names} {ocrPending.surname} · {ocrPending.passport_number} · {nationalityLabel(ocrPending.nationality)} · born {ocrPending.date_of_birth ? formatDate(ocrPending.date_of_birth) : "?"} · {ocrPending.sex ?? "?"} · expires {ocrPending.expiry ? formatDate(ocrPending.expiry) : "?"}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <Button type="button" size="sm" onClick={() => applyOcr(ocrPending)} disabled={saving}>
                        {saving ? <Loader2 className="animate-spin" /> : <Check />} Use these details
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setOcrPending(null)}>
                        I will type them
                      </Button>
                    </div>
                  </div>
                )}
                {present.has("passport") && !ocr && !ocrPending && !ocrError && (
                  <button type="button" className="mt-2 inline-flex items-center gap-1 text-xs text-mr-body hover:text-mr-ink" onClick={() => void runOcr(null, doc("passport")?.preview_url ?? null)}>
                    <ScanLine className="size-3" /> Read the details from the uploaded passport again
                  </button>
                )}
              </div>

              <div className={cn("rounded-md border p-3", passportIn ? "border-mr-ink/30 bg-mr-surface" : "border-mr-line opacity-60")}>
                <h3 className="text-sm font-semibold">Do you have the Hong Kong Pre-Arrival Registration (PAR)?</h3>
                <p className="mb-2 text-xs text-mr-muted">{passportIn ? "Choose one to continue." : "Upload both passport pages first."}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button type="button" variant={parAnswer === "has_par" ? "default" : "outline"} disabled={!passportIn || saving} onClick={() => void answerPar("has_par")}>
                    I have PAR
                  </Button>
                  <Button type="button" variant={parAnswer === "needs_par" ? "default" : "outline"} disabled={!passportIn || saving} onClick={() => void answerPar("needs_par")}>
                    I don&apos;t have PAR
                  </Button>
                </div>
              </div>
            </section>
          )}

          {step === 1 && (
            <section className="space-y-3">
              {parAnswer === "has_par" ? (
                <>
                  <h3 className="text-sm font-semibold">Upload your Hong Kong PAR</h3>
                  {slot("par")}
                </>
              ) : parAnswer === "needs_par" ? (
                <>
                  <h3 className="text-sm font-semibold">We apply for your PAR</h3>
                  <p className="rounded-md border border-mr-success/40 bg-mr-success/5 p-3 text-sm text-mr-body">
                    <Check className="mr-1 inline size-4 text-mr-success" />
                    Our team has been notified and will apply for your Hong Kong PAR. You can continue with the next steps.
                  </p>
                  <p className="text-xs text-mr-muted">Got the PAR yourself in the meantime? Upload it here any time; we will then not apply for it.</p>
                  {slot("par", { compact: true })}
                </>
              ) : (
                <p className="text-sm text-mr-body">Answer the PAR question in step 1 first.</p>
              )}
            </section>
          )}

          {step === 2 && (
            <section>
              <h3 className="mb-1 text-sm font-semibold">Your details</h3>
              <p className="mb-3 text-xs text-mr-muted">Check what was read from the passport and complete the rest.{locked ? " The name is fixed after submission; contact us if it is wrong." : ""}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Given name (as in passport) *" id={`gn-${passenger.id}`}>
                  <Input id={`gn-${passenger.id}`} value={details.given_name ?? ""} disabled={locked} onChange={(e) => set("given_name", e.target.value)} />
                </Field>
                <Field label="Surname (as in passport) *" id={`sn-${passenger.id}`}>
                  <Input id={`sn-${passenger.id}`} value={details.surname ?? ""} disabled={locked} onChange={(e) => set("surname", e.target.value)} />
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
                <Field label={kind === "b2b" ? "Address" : "Address *"} id={`ad-${passenger.id}`} className="sm:col-span-2">
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
                {dirty && <span className="text-xs text-mr-warning">Unsaved changes: save before continuing</span>}
              </div>
            </section>
          )}

          {step === 3 && (
            <section className="space-y-4">
              <div>
                <h3 className="mb-2 text-sm font-semibold">Passport photo and PAN card</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {slot("photo")}
                  {slot("pan_card", { onUploadedFile: (f, d) => void runPanOcr(f, d.preview_url) })}
                </div>
                {ocr && (
                  <div className="mt-3 flex items-center gap-3 text-sm text-mr-body">
                    <ScanLine className="size-4 animate-pulse" /> {ocr.label}… <Progress value={ocr.pct} className="h-1.5 w-40" />
                  </div>
                )}
              </div>
              <div>
                <h3 className="mb-1 text-sm font-semibold">Flight and hotel (optional)</h3>
                <p className="mb-2 text-xs text-mr-muted">If already booked. With PAR and hotel booking in, we apply for the visa directly.</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {slot("flight_ticket", { compact: true })}
                  {slot("hotel_booking", { compact: true })}
                </div>
              </div>
            </section>
          )}

          {step === 4 && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Cross-check before submitting</h3>
              <dl className="grid gap-x-4 gap-y-1 rounded-md border border-mr-line p-3 text-sm sm:grid-cols-2">
                <Row k="Name" v={`${passenger.given_name ?? ""} ${passenger.surname ?? ""}`.trim() || passenger.full_name} />
                <Row k="Passport number" v={passenger.passport_number} />
                <Row k="Nationality" v={passenger.nationality} />
                <Row k="Date of birth" v={passenger.date_of_birth ? formatDate(passenger.date_of_birth) : null} />
                <Row k="Sex" v={passenger.sex} />
                <Row k="Passport expiry" v={passenger.passport_expiry ? formatDate(passenger.passport_expiry) : null} />
                <Row k="PAN number" v={passenger.pan_number} />
                <Row k="Hong Kong PAR" v={parAnswer === "has_par" ? (present.has("par") ? "Uploaded" : "Not uploaded yet") : parAnswer === "needs_par" ? "We apply for it" : "Not answered"} />
                <Row k="Address" v={passenger.address} wide />
                <Row k="Phone / email" v={[passenger.phone, passenger.email].filter(Boolean).join(" · ") || null} wide />
              </dl>
              <ul className="grid gap-1 text-sm sm:grid-cols-2">
                {PORTAL_DOCS.map((d) => {
                  const x = doc(d.type);
                  const needed = d.need || (d.type === "par" && parAnswer === "has_par");
                  return (
                    <li key={d.type} className={cn("flex items-center gap-2 rounded-md border px-2.5 py-1.5", x ? "border-mr-success/40" : needed ? "border-mr-red/40" : "border-mr-line")}>
                      {x ? <Check className="size-4 text-mr-success" /> : <span className={cn("size-4 rounded-full border-2", needed ? "border-mr-red" : "border-mr-line")} />}
                      <span className="flex-1">{portalDocLabel(d.type)}</span>
                      <span className="text-[11px] text-mr-muted">{x ? formatDateTime(x.uploaded_at) : needed ? "missing" : "optional"}</span>
                    </li>
                  );
                })}
              </ul>
              {!c.complete ? (
                <p className="text-sm text-mr-warning">Still missing: {missingSummary(c)}. Go back to the step and complete it.</p>
              ) : locked ? (
                <p className="text-sm text-mr-success">
                  <Lock className="mr-1 inline size-4" /> Submitted. The name is fixed; documents can still be replaced (each replacement is time-stamped and the earlier copy is kept).
                </p>
              ) : onSubmit ? (
                <Button type="button" onClick={onSubmit} disabled={submitting}>
                  {submitting ? <Loader2 className="animate-spin" /> : <Send />} {submitLabel ?? "Submit application"}
                </Button>
              ) : (
                <p className="text-sm text-mr-success">
                  <Check className="mr-1 inline size-4" /> This passenger is complete.{alwaysOpen ? " The main applicant submits the application." : ""}
                </p>
              )}
            </section>
          )}

          {/* Step navigation */}
          <div className="mt-4 flex items-center justify-between gap-2 border-t border-mr-line pt-3">
            <Button type="button" variant="ghost" size="sm" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
              <ArrowLeft /> Back
            </Button>
            <div className="flex items-center gap-2">
              {canInvite && !locked && (
                <Button type="button" variant="ghost" size="sm" onClick={invite} disabled={inviting}>
                  {inviting ? <Loader2 className="animate-spin" /> : <Link2 />} {inviteLink ? "Copy their link" : "Send them a link"}
                </Button>
              )}
              {canRemove && !locked && (
                <Button type="button" variant="ghost" size="sm" className="text-mr-red" onClick={remove} disabled={removing || passenger.grouped} title={passenger.grouped ? "Already placed in a travel group" : undefined}>
                  {removing ? <Loader2 className="animate-spin" /> : <Trash2 />} Remove
                </Button>
              )}
              {step < 4 && (
                <Button type="button" size="sm" onClick={() => setStep((s) => s + 1)} disabled={!canNext || (step === 2 && dirty)} title={!canNext ? "Complete this step first" : undefined}>
                  Next <ArrowRight />
                </Button>
              )}
            </div>
          </div>
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

function Row({ k, v, wide }: { k: string; v: string | null | undefined; wide?: boolean }) {
  return (
    <div className={cn("flex gap-2", wide && "sm:col-span-2")}>
      <dt className="w-32 shrink-0 text-mr-muted">{k}</dt>
      <dd className={cn("min-w-0 break-words", v ? "text-mr-ink" : "text-mr-warning")}>{v || "missing"}</dd>
    </div>
  );
}
