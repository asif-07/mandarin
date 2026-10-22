"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, Copy, Eye, FileText, Loader2, RefreshCw, Save, ScanLine, Send, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { applicantCompleteness, PORTAL_DOCS, portalDocLabel, type ApplicantDoc, type ApplicantView } from "@/lib/apply/shared";
import { nationalityLabel, type MrzResult } from "@/lib/apply/mrz";
import { readPassportMrz } from "@/components/apply/passport-ocr";
import { formatDate, formatDateTime, formatFileSize } from "@/lib/format";
import { cn } from "@/lib/utils";

const ACCEPT = ".pdf,.jpg,.jpeg,.png,.heic,.heif";

type Profile = {
  full_name: string;
  phone: string;
  email: string;
  nationality: string;
  passport_number: string;
  date_of_birth: string;
  sex: string;
  passport_expiry: string;
  address: string;
  pan_number: string;
  travel_start_date: string;
  travel_end_date: string;
};

function toProfile(a: ApplicantView): Profile {
  return {
    full_name: a.full_name,
    phone: a.phone ?? "",
    email: a.email ?? "",
    nationality: a.nationality ?? "",
    passport_number: a.passport_number ?? "",
    date_of_birth: a.date_of_birth ?? "",
    sex: a.sex ?? "",
    passport_expiry: a.passport_expiry ?? "",
    address: a.address ?? "",
    pan_number: a.pan_number ?? "",
    travel_start_date: a.travel_start_date,
    travel_end_date: a.travel_end_date,
  };
}

/** The customer's application page: passport scan, details, photo + PAN, optional PAR / hotel / flight, submit. */
export function ApplyProfile({ initial }: { initial: ApplicantView }) {
  const router = useRouter();
  const token = initial.token;
  const [docs, setDocs] = useState<ApplicantDoc[]>(initial.documents);
  const [profile, setProfile] = useState<Profile>(() => toProfile(initial));
  const [saved, setSaved] = useState<Profile>(() => toProfile(initial));
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState(initial.portal_status);
  const [submittedAt, setSubmittedAt] = useState(initial.portal_submitted_at);
  const [ocr, setOcr] = useState<{ label: string; pct: number } | null>(null);
  const [ocrResult, setOcrResult] = useState<MrzResult | null>(null);
  const [ocrPending, setOcrPending] = useState<MrzResult | null>(null);
  const dirty = JSON.stringify(profile) !== JSON.stringify(saved);
  const grouped = !!initial.group_ref;

  const completeness = applicantCompleteness({ ...saved, documents: docs });
  const link = typeof window !== "undefined" ? `${window.location.origin}/apply/t/${token}` : `/apply/t/${token}`;

  function set<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile((p) => ({ ...p, [key]: value }));
  }

  async function runOcr(file: File) {
    setOcr({ label: "Preparing", pct: 2 });
    setOcrResult(null);
    try {
      const result = await readPassportMrz(file, (label, pct) => setOcr({ label, pct }));
      if (!result) {
        toast.message("Could not read the passport automatically. Please type the details below.", { duration: 6000 });
        return;
      }
      setOcrResult(result);
      setOcrPending(result);
    } catch (e) {
      toast.message(`Passport reading is not available (${e instanceof Error ? e.message : "error"}). Please type the details below.`);
    } finally {
      setOcr(null);
    }
  }

  function applyOcr(r: MrzResult) {
    setProfile((p) => ({
      ...p,
      full_name: r.full_name || p.full_name,
      passport_number: r.passport_number || p.passport_number,
      nationality: r.nationality ? nationalityLabel(r.nationality) : p.nationality,
      date_of_birth: r.date_of_birth ?? p.date_of_birth,
      sex: r.sex ?? p.sex,
      passport_expiry: r.expiry ?? p.passport_expiry,
    }));
    setOcrPending(null);
    toast.success("Passport details filled in. Please check them and save.");
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/apply/${token}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...profile, passport_ocr: ocrResult ? { ...ocrResult, read_at: new Date().toISOString() } : undefined }) });
      const body = (await res.json().catch(() => ({}))) as { error?: string; datesLocked?: boolean };
      if (!res.ok) return void toast.error(body.error ?? "Could not save");
      setSaved(profile);
      toast.success("Details saved");
      if (body.datesLocked) toast.message("Your travel dates are set by your group now; contact us to change them.");
      router.refresh();
    } catch {
      toast.error("No connection. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function submit() {
    if (dirty) await save();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/apply/${token}/submit`, { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { error?: string; ready?: boolean; submitted_at?: string };
      if (!res.ok) return void toast.error(body.error ?? "Could not submit");
      setStatus("submitted");
      setSubmittedAt(body.submitted_at ?? new Date().toISOString());
      toast.success(body.ready ? "Application submitted. You have your PAR and hotel, so we apply directly." : "Application submitted. We will prepare the PAR and hotel details and contact you.", { duration: 8000 });
      window.scrollTo({ top: 0, behavior: "smooth" });
      router.refresh();
    } catch {
      toast.error("No connection. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const required = PORTAL_DOCS.filter((d) => d.need);
  const optional = PORTAL_DOCS.filter((d) => !d.need);
  const present = new Set(docs.map((d) => d.doc_type));
  const steps = [
    { label: "Passport", done: present.has("passport") },
    { label: "Your details", done: completeness.missingFields.length === 0 },
    { label: "Photo & PAN", done: present.has("photo") && present.has("pan_card") },
    { label: status === "submitted" || status === "reviewed" ? "Submitted" : "Submit", done: status === "submitted" || status === "reviewed" },
  ];

  return (
    <div className="space-y-6">
      {/* Status */}
      <div className={cn("rounded-lg border p-4", status === "submitted" || status === "reviewed" ? "border-mr-success/40 bg-mr-success/5" : "border-mr-line bg-white")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-heading text-lg font-semibold">{saved.full_name}</p>
            <p className="text-sm text-mr-body">
              {formatDate(saved.travel_start_date)} to {formatDate(saved.travel_end_date)} · reference <span className="font-mono">{initial.traveller_ref}</span>
              {initial.group_ref ? ` · group ${initial.group_ref}` : ""}
            </p>
            {status === "submitted" || status === "reviewed" ? (
              <p className="mt-1 text-sm text-mr-success">
                <CheckCircle2 className="mr-1 inline size-4" />
                Submitted {submittedAt ? formatDateTime(submittedAt) : ""}. {completeness.ready ? "You uploaded your PAR and hotel booking: we apply directly." : "We prepare the PAR and hotel details and contact you."} You can still add or replace documents here.
              </p>
            ) : (
              <p className="mt-1 text-sm text-mr-muted">Not submitted yet. Complete the steps below.</p>
            )}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(link).then(() => toast.success("Link copied. Keep it to come back later.")).catch(() => toast.error("Copy failed"))}>
            <Copy /> Copy my link
          </Button>
        </div>
        <ol className="mt-4 grid grid-cols-4 gap-1 text-center text-[11px] sm:text-xs">
          {steps.map((s, i) => (
            <li key={s.label} className={cn("rounded-md border px-1 py-1.5", s.done ? "border-mr-success/40 bg-mr-success/10 text-mr-success" : "border-mr-line text-mr-muted")}>
              {s.done ? <CheckCircle2 className="mr-1 inline size-3" /> : <Circle className="mr-1 inline size-3" />}
              {i + 1}. {s.label}
            </li>
          ))}
        </ol>
      </div>

      {/* Step 1: passport */}
      <section className="rounded-lg border border-mr-line bg-white p-4">
        <h2 className="font-heading text-base font-semibold">1. Passport</h2>
        <p className="mb-3 text-sm text-mr-body">Upload a clear photo of the passport data page. We read the two lines at the bottom to fill in your details; nothing is sent anywhere for that.</p>
        <DocSlot token={token} spec={required[0]!} doc={docs.find((d) => d.doc_type === "passport")} onChange={setDocs} onUploadedFile={(f) => void runOcr(f)} />
        {ocr && (
          <div className="mt-3 flex items-center gap-3 text-sm text-mr-body">
            <ScanLine className="size-4 animate-pulse" /> {ocr.label}… <Progress value={ocr.pct} className="h-1.5 w-40" />
          </div>
        )}
        {ocrPending && (
          <div className="mt-3 rounded-md border border-mr-ink bg-mr-surface p-3 text-sm">
            <p className="font-medium text-mr-ink">We read your passport{ocrPending.valid ? "" : " (some characters were unclear, please check carefully)"}:</p>
            <p className="mt-1 text-mr-body">
              {ocrPending.full_name} · {ocrPending.passport_number} · {nationalityLabel(ocrPending.nationality)} · born {ocrPending.date_of_birth ? formatDate(ocrPending.date_of_birth) : "?"} · {ocrPending.sex ?? "?"} · expires {ocrPending.expiry ? formatDate(ocrPending.expiry) : "?"}
            </p>
            <div className="mt-2 flex gap-2">
              <Button type="button" size="sm" onClick={() => applyOcr(ocrPending)}>
                Use these details
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setOcrPending(null)}>
                I will type them
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

      {/* Step 2: details */}
      <section className="rounded-lg border border-mr-line bg-white p-4">
        <h2 className="font-heading text-base font-semibold">2. Your details</h2>
        <p className="mb-3 text-sm text-mr-body">Check what we read from the passport, then add your address and PAN number. Fields marked * are needed to submit.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name (as in passport) *" id="p_name" className="sm:col-span-2">
            <Input id="p_name" value={profile.full_name} onChange={(e) => set("full_name", e.target.value)} />
          </Field>
          <Field label="Passport number *" id="p_num">
            <Input id="p_num" className="uppercase" autoCapitalize="characters" value={profile.passport_number} onChange={(e) => set("passport_number", e.target.value.toUpperCase())} />
          </Field>
          <Field label="Nationality" id="p_nat">
            <Input id="p_nat" value={profile.nationality} onChange={(e) => set("nationality", e.target.value)} />
          </Field>
          <Field label="Date of birth" id="p_dob">
            <Input id="p_dob" type="date" value={profile.date_of_birth} onChange={(e) => set("date_of_birth", e.target.value)} />
          </Field>
          <Field label="Sex" id="p_sex">
            <Select value={profile.sex || "none"} onValueChange={(v) => set("sex", v === "none" ? "" : v)}>
              <SelectTrigger id="p_sex" className="w-full">
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
          <Field label="Passport expiry" id="p_exp">
            <Input id="p_exp" type="date" value={profile.passport_expiry} onChange={(e) => set("passport_expiry", e.target.value)} />
          </Field>
          <Field label="PAN number *" id="p_pan">
            <Input id="p_pan" className="uppercase" placeholder="ABCDE1234F" autoCapitalize="characters" value={profile.pan_number} onChange={(e) => set("pan_number", e.target.value.toUpperCase())} />
          </Field>
          <Field label="Address *" id="p_addr" className="sm:col-span-2">
            <Textarea id="p_addr" rows={2} value={profile.address} onChange={(e) => set("address", e.target.value)} placeholder="House / flat, street, city, country" />
          </Field>
          <Field label="Phone (WhatsApp)" id="p_phone">
            <Input id="p_phone" type="tel" value={profile.phone} onChange={(e) => set("phone", e.target.value)} />
          </Field>
          <Field label="Email" id="p_email">
            <Input id="p_email" type="email" value={profile.email} onChange={(e) => set("email", e.target.value)} />
          </Field>
          <Field label="Entry into China" id="p_start">
            <Input id="p_start" type="date" value={profile.travel_start_date} disabled={grouped} onChange={(e) => set("travel_start_date", e.target.value)} />
          </Field>
          <Field label="Exit from China" id="p_end">
            <Input id="p_end" type="date" value={profile.travel_end_date} min={profile.travel_start_date} disabled={grouped} onChange={(e) => set("travel_end_date", e.target.value)} />
          </Field>
          {grouped && <p className="text-xs text-mr-muted sm:col-span-2">Your dates are fixed by your travel group {initial.group_ref}. Contact us to change them.</p>}
        </div>
        <div className="mt-4 flex items-center gap-2">
          <Button type="button" onClick={save} disabled={!dirty || saving}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />} Save details
          </Button>
          {dirty && <span className="text-xs text-mr-warning">Unsaved changes</span>}
        </div>
      </section>

      {/* Step 3: photo + PAN */}
      <section className="rounded-lg border border-mr-line bg-white p-4">
        <h2 className="font-heading text-base font-semibold">3. Photo and PAN card</h2>
        <p className="mb-3 text-sm text-mr-body">Both are needed for the visa application.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {required.slice(1).map((spec) => (
            <DocSlot key={spec.type} token={token} spec={spec} doc={docs.find((d) => d.doc_type === spec.type)} onChange={setDocs} />
          ))}
        </div>
      </section>

      {/* Step 4: optional */}
      <section className="rounded-lg border border-mr-line bg-white p-4">
        <h2 className="font-heading text-base font-semibold">4. Already have your PAR, hotel or flight?</h2>
        <p className="mb-3 text-sm text-mr-body">
          Optional. If you upload your <strong>PAR and hotel booking</strong>, we apply for the visa directly. If not, we prepare them for you from your passport and get in touch.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {optional.map((spec) => (
            <DocSlot key={spec.type} token={token} spec={spec} doc={docs.find((d) => d.doc_type === spec.type)} onChange={setDocs} />
          ))}
        </div>
      </section>

      {/* Submit */}
      <section className={cn("rounded-lg border p-4", completeness.canSubmit ? "border-mr-ink bg-mr-surface" : "border-mr-line bg-white")}>
        <h2 className="font-heading text-base font-semibold">{status === "submitted" || status === "reviewed" ? "Send an update" : "5. Submit"}</h2>
        {completeness.canSubmit ? (
          <p className="mt-1 text-sm text-mr-body">{completeness.ready ? "Everything is in, including PAR and hotel: we can apply directly." : "Everything needed is in. We will prepare the PAR and hotel details for you."}</p>
        ) : (
          <ul className="mt-1 list-inside list-disc text-sm text-mr-body">
            {completeness.missingDocs.map((d) => (
              <li key={d}>Upload your {portalDocLabel(d).toLowerCase()}</li>
            ))}
            {completeness.missingFields.map((f) => (
              <li key={f}>Fill in and save your {({ full_name: "name", passport_number: "passport number", address: "address", pan_number: "PAN number" } as Record<string, string>)[f] ?? f}</li>
            ))}
          </ul>
        )}
        <Button type="button" className="mt-3" onClick={submit} disabled={!completeness.canSubmit || submitting}>
          {submitting ? <Loader2 className="animate-spin" /> : <Send />} {status === "submitted" || status === "reviewed" ? "Re-send application" : completeness.ready ? "Apply directly" : "Submit application"}
        </Button>
      </section>
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

/** One upload slot on the customer's page. */
function DocSlot({ token, spec, doc, onChange, onUploadedFile }: { token: string; spec: (typeof PORTAL_DOCS)[number]; doc?: ApplicantDoc; onChange: (fn: (docs: ApplicantDoc[]) => ApplicantDoc[]) => void; onUploadedFile?: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("doc_type", spec.type);
      const res = await fetch(`/api/apply/${token}/documents`, { method: "POST", body: fd });
      const body = (await res.json().catch(() => ({}))) as { error?: string; document?: ApplicantDoc };
      if (!res.ok || !body.document) return void toast.error(body.error ?? "Upload failed");
      const d = body.document;
      onChange((docs) => [...docs.filter((x) => x.doc_type !== spec.type), d]);
      toast.success(`${spec.title} uploaded`);
      onUploadedFile?.(file);
    } catch {
      toast.error("No connection. Please try again.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove() {
    if (!doc) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/apply/${token}/documents`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: doc.id }) });
      if (!res.ok) return void toast.error("Could not remove");
      onChange((docs) => docs.filter((x) => x.id !== doc.id));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={cn("rounded-lg border p-3", doc ? "border-mr-success/40" : "border-dashed border-mr-line", over && "border-mr-ink bg-mr-surface")}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (e.dataTransfer.files[0]) void upload(e.dataTransfer.files[0]);
      }}
    >
      <input ref={inputRef} type="file" accept={ACCEPT} className="sr-only" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-mr-ink">
          {spec.title}
          {spec.need ? " *" : ""}
        </span>
        {doc ? <CheckCircle2 className="size-4 text-mr-success" /> : <span className="size-4 rounded-full border-2 border-mr-line" />}
      </div>
      {busy ? (
        <div className="flex h-24 items-center justify-center gap-2 text-sm text-mr-body">
          <Loader2 className="size-4 animate-spin" /> Uploading…
        </div>
      ) : doc ? (
        <div>
          {doc.preview_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={doc.preview_url} alt="" className="h-24 w-full rounded-md border border-mr-line object-cover" />
          ) : (
            <div className="flex h-24 items-center justify-center rounded-md border border-mr-line bg-mr-surface text-mr-muted">
              <FileText className="size-5" /> <span className="ml-2 text-xs font-medium">PDF</span>
            </div>
          )}
          <p className="mt-1 truncate text-xs text-mr-body" title={doc.file_name}>
            {doc.file_name} · {formatFileSize(doc.file_size)}
          </p>
          <div className="mt-1 flex items-center gap-1">
            <a href={`/api/apply/${token}/documents/${doc.id}`} target="_blank" rel="noopener" className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-mr-body hover:bg-mr-surface hover:text-mr-ink">
              <Eye className="size-3.5" /> View
            </a>
            <button type="button" onClick={() => inputRef.current?.click()} className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-mr-body hover:bg-mr-surface hover:text-mr-ink">
              <RefreshCw className="size-3.5" /> Replace
            </button>
            <button type="button" onClick={remove} className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-mr-body hover:bg-mr-surface hover:text-mr-red">
              <Trash2 className="size-3.5" /> Remove
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()} className="flex h-24 w-full flex-col items-center justify-center gap-1 rounded-md text-mr-muted hover:text-mr-ink">
          <UploadCloud className="size-5" />
          <span className="text-xs">Tap to upload or take a photo</span>
          <span className="text-[10px]">PDF, JPG, PNG, HEIC · max 15 MB</span>
        </button>
      )}
      <p className="mt-2 text-[11px] leading-snug text-mr-muted">{spec.hint}</p>
    </div>
  );
}
