"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, UploadCloud, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ACCEPT, uploadPortalDocument } from "@/components/apply/doc-slot";
import { savePassengerDetails } from "@/components/apply/passenger-card";
import { readPanNumber, readPassportMrz } from "@/components/apply/passport-ocr";
import { PORTAL_DOCS, portalDocLabel, type PassengerView } from "@/lib/apply/shared";
import { nationalityLabel } from "@/lib/apply/mrz";
import { checkUploadFile, guessDocType } from "@/lib/validation/travel";
import { cn } from "@/lib/utils";

type Row = { file: File; type: string | null; status: "queued" | "reading" | "uploading" | "done" | "failed" | "assign"; note: string; passengerId?: string };

const PORTAL_TYPES = new Set<string>(PORTAL_DOCS.map((d) => d.type));

/** Does this file name mention the passenger (any name part of 3+ letters)? */
function matchPassenger(fileName: string, passengers: PassengerView[]): PassengerView | null {
  const hay = fileName.toLowerCase().replace(/[^a-z]+/g, " ");
  const hits = passengers.filter((p) => p.full_name.toLowerCase().split(/\s+/).some((tok) => tok.length >= 3 && new RegExp(`\\b${tok}\\b`).test(hay)));
  return hits.length === 1 ? hits[0]! : null;
}

/**
 * Agent bulk upload: drop every file at once. Passports are read (MRZ) and
 * become passengers; photos, PAN cards, PARs, hotel and flight files are
 * matched to passengers by the name in the file name; whatever cannot be
 * placed is assigned by hand in a small dialog. PAN numbers are read off
 * the PAN cards.
 */
export function BulkUpload({ token, passengers, onPassengerAdded, onPassengerChanged }: { token: string; passengers: PassengerView[]; onPassengerAdded: (p: PassengerView) => void; onPassengerChanged: (p: PassengerView) => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);
  const [over, setOver] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignBusy, setAssignBusy] = useState(false);
  // Passengers created during this run, so matching sees them before the parent re-renders.
  const live = (): PassengerView[] => [...passengers, ...created];
  let created: PassengerView[] = [];

  function update(i: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  async function run(files: File[]) {
    const accepted: Row[] = [];
    for (const f of files) {
      const chk = checkUploadFile(f);
      if (!chk.ok) {
        toast.error(chk.error);
        continue;
      }
      const guessed = guessDocType(f.name);
      accepted.push({ file: f, type: guessed && PORTAL_TYPES.has(guessed) ? guessed : null, status: "queued", note: "" });
    }
    if (!accepted.length) return;
    const base = rows.length;
    setRows((rs) => [...rs, ...accepted]);
    setRunning(true);
    created = [];
    try {
      // 1. Passports (and untyped images, which are usually passports) → OCR → passenger
      for (let k = 0; k < accepted.length; k++) {
        const r = accepted[k]!;
        const i = base + k;
        const maybePassport = r.type === "passport" || (r.type === null && r.file.type.startsWith("image/"));
        if (!maybePassport) continue;
        update(i, { status: "reading", note: "Reading passport…" });
        const mrz = await readPassportMrz(r.file).catch(() => null);
        if (!mrz && r.type !== "passport") {
          update(i, { status: "assign", note: "Not a readable passport: assign it below" });
          continue;
        }
        const name = mrz?.full_name || r.file.name.replace(/\.[^.]+$/, "").replace(/[_\-]+/g, " ").replace(/passport|ppt|scan|copy|\d+/gi, "").trim() || "Passenger";
        const existing = mrz?.passport_number ? live().find((p) => p.passport_number === mrz.passport_number) : null;
        let passenger = existing ?? null;
        if (!passenger) {
          update(i, { status: "uploading", note: `Adding ${name}…` });
          const res = await fetch(`/api/apply/${token}/passengers`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ full_name: name, passport_number: mrz?.passport_number ?? null, nationality: mrz?.nationality ? nationalityLabel(mrz.nationality) : null, date_of_birth: mrz?.date_of_birth ?? null, sex: mrz?.sex ?? null, passport_expiry: mrz?.expiry ?? null, passport_ocr: mrz ? { ...mrz, read_at: new Date().toISOString() } : undefined }),
          });
          const body = (await res.json().catch(() => ({}))) as { error?: string; passenger?: PassengerView };
          if (!res.ok || !body.passenger) {
            update(i, { status: "failed", note: body.error ?? "Could not add the passenger" });
            continue;
          }
          passenger = body.passenger;
          created.push(passenger);
          onPassengerAdded(passenger);
        }
        try {
          const doc = await uploadPortalDocument(token, passenger.id, "passport", r.file);
          const updated = { ...passenger, documents: [...passenger.documents.filter((d) => d.doc_type !== "passport"), doc] };
          created = created.map((p) => (p.id === updated.id ? updated : p));
          onPassengerChanged(updated);
          update(i, { status: "done", passengerId: passenger.id, note: `${passenger.full_name}${mrz ? (mrz.valid ? " · passport read" : " · passport read, please check the details") : " · name from the file name, please check"}` });
        } catch (e) {
          update(i, { status: "failed", note: e instanceof Error ? e.message : "Upload failed" });
        }
      }
      // 2. Everything else → match by name in the file name
      for (let k = 0; k < accepted.length; k++) {
        const r = accepted[k]!;
        const i = base + k;
        const maybePassport = r.type === "passport" || (r.type === null && r.file.type.startsWith("image/"));
        if (maybePassport) continue;
        const all = live();
        const target = matchPassenger(r.file.name, all) ?? (all.length === 1 ? all[0]! : null);
        if (!target || !r.type) {
          update(i, { status: "assign", note: !r.type ? "Which document is this? Assign it below" : "Which passenger? Assign it below" });
          continue;
        }
        await place(i, r, target, r.type);
      }
    } finally {
      setRunning(false);
    }
    if (accepted.some((r) => r.status !== "done")) setRows((rs) => (rs.some((r) => r.status === "assign") ? rs : rs));
  }

  async function place(i: number, r: Row, target: PassengerView, type: string) {
    update(i, { status: "uploading", note: `${portalDocLabel(type)} → ${target.full_name}` });
    try {
      const doc = await uploadPortalDocument(token, target.id, type, r.file);
      let updated: PassengerView = { ...target, documents: [...target.documents.filter((d) => d.doc_type !== type), doc] };
      if (type === "pan_card" && !target.pan_number) {
        const pan = await readPanNumber(r.file).catch(() => null);
        if (pan) updated = await savePassengerDetails(token, target.id, { pan_number: pan, full_name: target.full_name }).catch(() => updated);
      }
      created = created.map((p) => (p.id === updated.id ? updated : p));
      onPassengerChanged(updated);
      update(i, { status: "done", passengerId: target.id, note: `${portalDocLabel(type)} → ${target.full_name}${type === "pan_card" && updated.pan_number && !target.pan_number ? ` · PAN ${updated.pan_number} read` : ""}` });
    } catch (e) {
      update(i, { status: "failed", note: e instanceof Error ? e.message : "Upload failed" });
    }
  }

  async function confirmAssign() {
    const pending = rows.map((r, i) => ({ r, i })).filter(({ r }) => r.status === "assign");
    if (pending.some(({ r }) => !r.passengerId || !r.type)) return void toast.error("Choose a passenger and a document type for every file");
    setAssignBusy(true);
    for (const { r, i } of pending) {
      const target = passengers.find((p) => p.id === r.passengerId);
      if (target && r.type) await place(i, r, target, r.type);
    }
    setAssignBusy(false);
    setAssignOpen(false);
  }

  const toAssign = rows.filter((r) => r.status === "assign").length;

  return (
    <div>
      <label
        className={cn("flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-8 text-center", over ? "border-mr-ink bg-mr-surface" : "border-mr-line hover:bg-mr-surface")}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (e.dataTransfer.files.length) void run(Array.from(e.dataTransfer.files));
        }}
      >
        <input type="file" multiple accept={ACCEPT} className="sr-only" disabled={running} onChange={(e) => e.target.files && void run(Array.from(e.target.files))} />
        {running ? <Loader2 className="size-6 animate-spin text-mr-body" /> : <UploadCloud className="size-6 text-mr-body" />}
        <span className="text-sm font-medium text-mr-ink">{running ? "Working through the files…" : "Drop all the files here, or tap to choose"}</span>
        <span className="text-xs text-mr-muted">Passports first: each one becomes a passenger. Name photos, PAN cards, PARs, hotel and flight files after the passenger (e.g. “Rahul PAN.jpg”) and they are matched automatically.</span>
      </label>
      {rows.length > 0 && (
        <ul className="mt-3 max-h-72 space-y-1 overflow-y-auto text-xs">
          {rows.map((r, i) => (
            <li key={i} className="flex items-center gap-2">
              {r.status === "done" ? <CheckCircle2 className="size-3.5 shrink-0 text-mr-success" /> : r.status === "failed" ? <XCircle className="size-3.5 shrink-0 text-mr-red" /> : r.status === "assign" ? <span className="size-3.5 shrink-0 rounded-full border-2 border-mr-warning" /> : <Loader2 className="size-3.5 shrink-0 animate-spin text-mr-body" />}
              <span className="min-w-0 truncate text-mr-body" title={r.file.name}>
                {r.file.name}
              </span>
              <span className={cn("ml-auto shrink-0 text-right", r.status === "failed" ? "text-mr-red" : r.status === "assign" ? "text-mr-warning" : "text-mr-muted")}>{r.note}</span>
            </li>
          ))}
        </ul>
      )}
      {toAssign > 0 && !running && (
        <Button type="button" size="sm" className="mt-3" onClick={() => setAssignOpen(true)}>
          Assign {toAssign} file{toAssign === 1 ? "" : "s"}
        </Button>
      )}
      <Dialog open={assignOpen} onOpenChange={(o) => !assignBusy && setAssignOpen(o)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Assign files</DialogTitle>
            <DialogDescription>Choose the passenger and the document type for each file we could not place.</DialogDescription>
          </DialogHeader>
          <ul className="max-h-[50vh] space-y-2 overflow-y-auto">
            {rows.map((r, i) =>
              r.status !== "assign" ? null : (
                <li key={i} className="grid gap-2 sm:grid-cols-[1fr_160px_150px] sm:items-center">
                  <span className="min-w-0 truncate text-sm" title={r.file.name}>
                    {r.file.name}
                  </span>
                  <Select value={r.passengerId ?? ""} onValueChange={(v) => update(i, { passengerId: v })} disabled={assignBusy}>
                    <SelectTrigger className="rounded-lg" aria-label="Passenger">
                      <SelectValue placeholder="Passenger" />
                    </SelectTrigger>
                    <SelectContent>
                      {passengers.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={r.type ?? ""} onValueChange={(v) => update(i, { type: v })} disabled={assignBusy}>
                    <SelectTrigger className="rounded-lg" aria-label="Document type">
                      <SelectValue placeholder="Document" />
                    </SelectTrigger>
                    <SelectContent>
                      {PORTAL_DOCS.map((d) => (
                        <SelectItem key={d.type} value={d.type}>
                          {d.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </li>
              ),
            )}
          </ul>
          {passengers.length === 0 && <p className="text-sm text-mr-warning">Add a passenger first (upload a passport, or use Add passenger).</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)} disabled={assignBusy}>
              Later
            </Button>
            <Button onClick={confirmAssign} disabled={assignBusy || passengers.length === 0}>
              {assignBusy && <Loader2 className="animate-spin" />} Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
