"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, FileUp, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { previewB2bCode, registerB2bGroup, replaceB2bPack, type B2bPreview } from "@/lib/actions/travel-groups";
import { cleanB2bCode, parseB2bCode } from "@/lib/travel/b2b-code";
import { BUCKETS, CHINA_PORTS, PACKAGE_TIERS, tierHasHotel, tierNeedsStars } from "@/lib/constants";
import { HotelStarsSelect } from "@/components/travel/hotel-stars-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateRange, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";

const MAX_BYTES = 200 * 1024 * 1024;

async function uploadIncoming(file: File): Promise<string> {
  const supabase = createClient();
  const path = `_b2b/incoming/${crypto.randomUUID()}.pdf`;
  const { error } = await supabase.storage.from(BUCKETS.travelPacks).upload(path, file, { contentType: "application/pdf", upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

function acceptPdf(file: File | undefined): file is File {
  if (!file) return false;
  if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
    toast.error("Only PDF files are accepted");
    return false;
  }
  if (file.size > MAX_BYTES) {
    toast.error("File is larger than 200 MB");
    return false;
  }
  return true;
}

type Form = { code: string; entry_port: string; exit_port: string; label: string; guide_name: string; notes: string; package_tier: string | null; hotel_name: string; hotel_stars: number | null };
const EMPTY: Form = { code: "", entry_port: "", exit_port: "", label: "", guide_name: "", notes: "", package_tier: null, hotel_name: "", hotel_stars: null };

/** Upload a partner's compiled pack; the group is created under the next free code for that date. */
export function B2bUploadButton({ variant = "default" }: { variant?: "default" | "outline" }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [preview, setPreview] = useState<B2bPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function reset() {
    setFile(null);
    setForm(EMPTY);
    setPreview(null);
    setPreviewError(null);
  }

  function pick(f: File | undefined) {
    if (!acceptPdf(f)) return;
    setFile(f);
    // The partner's code is usually the file name.
    const fromName = cleanB2bCode(f.name);
    if (parseB2bCode(fromName, todayISO()).ok) setForm((x) => ({ ...x, code: fromName }));
  }

  // Live preview of dates and the G-code we will assign.
  useEffect(() => {
    if (!open) return;
    const code = form.code.trim();
    if (timer.current) clearTimeout(timer.current);
    if (!code) {
      setPreview(null);
      setPreviewError(null);
      return;
    }
    const local = parseB2bCode(code, todayISO());
    if (!local.ok) {
      setPreview(null);
      setPreviewError(local.error);
      return;
    }
    setChecking(true);
    timer.current = setTimeout(async () => {
      const res = await previewB2bCode(code);
      setChecking(false);
      if (!res.ok) {
        setPreview(null);
        setPreviewError(res.error);
      } else {
        setPreview(res.data);
        setPreviewError(null);
      }
    }, 350);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [form.code, open]);

  function submit() {
    if (!file || !preview) return;
    startTransition(async () => {
      setUploading(true);
      let path: string;
      try {
        path = await uploadIncoming(file);
      } catch (e) {
        setUploading(false);
        return void toast.error(`Upload failed: ${e instanceof Error ? e.message : "unknown error"}`);
      }
      setUploading(false);
      const res = await registerB2bGroup({ code: form.code, upload_path: path, file_name: file.name, entry_port: form.entry_port, exit_port: form.exit_port, label: form.label, guide_name: form.guide_name, notes: form.notes, package_tier: form.package_tier, hotel_name: form.hotel_name, hotel_stars: form.hotel_stars });
      if (!res.ok) return void toast.error(res.error);
      toast.success(`Filed as ${res.data.reference}`, { description: `Group ${res.data.group_code} created on ${res.data.travel_date}`, duration: 8000 });
      setOpen(false);
      reset();
      router.refresh();
    });
  }

  const busy = pending || uploading;

  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        <Upload /> Upload partner pack
      </Button>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (busy) return;
          setOpen(o);
          if (!o) reset();
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Upload a B2B partner pack</DialogTitle>
            <DialogDescription>
              The partner&rsquo;s compiled PDF and their code. We file it under the next free group number on that date and rename it to our reference.
            </DialogDescription>
          </DialogHeader>

          <fieldset disabled={busy} className="grid gap-4">
            <div
              className={cn("flex flex-col items-center justify-center rounded-lg border border-dashed px-4 py-6 text-center", file ? "border-mr-ink" : "border-mr-line")}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                pick(e.dataTransfer.files?.[0]);
              }}
            >
              <FileUp className="size-5 text-mr-muted" />
              <p className="mt-2 text-sm text-mr-body">{file ? file.name : "Drop the PDF here, or choose a file"}</p>
              {file && <p className="text-xs text-mr-muted">{(file.size / 1024 / 1024).toFixed(1)} MB</p>}
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => {
                  pick(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => fileRef.current?.click()}>
                {file ? "Choose a different file" : "Choose PDF"}
              </Button>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="b2b_code">Partner&rsquo;s code</Label>
              <Input id="b2b_code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="MR144-EDPT-OCT15-OCT20-100PX-G01" className="font-mono" autoComplete="off" />
              <p className="text-xs text-mr-muted">Prefix · partner · entry date · exit date · pax · their group number. Filled from the file name when it matches.</p>
            </div>

            {previewError && form.code && (
              <p className="flex items-center gap-2 text-sm text-mr-red">
                <AlertTriangle className="size-4" /> {previewError}
              </p>
            )}
            {checking && !preview && !previewError && (
              <p className="flex items-center gap-2 text-sm text-mr-muted">
                <Loader2 className="size-4 animate-spin" /> Checking that date…
              </p>
            )}
            {preview && (
              <div className="rounded-lg border border-mr-line bg-mr-surface p-4 text-sm">
                <dl className="grid grid-cols-[130px_1fr] gap-y-1.5">
                  <dt className="text-mr-muted">Partner</dt>
                  <dd className="font-medium text-mr-ink">{preview.partner_code}</dd>
                  <dt className="text-mr-muted">Travel dates</dt>
                  <dd className="font-medium text-mr-ink">{formatDateRange(preview.travel_date, preview.travel_end_date)}</dd>
                  <dt className="text-mr-muted">Pax</dt>
                  <dd className="tnum font-medium text-mr-ink">{preview.pax}</dd>
                  <dt className="text-mr-muted">Their group</dt>
                  <dd>{preview.partner_group}</dd>
                  <dt className="text-mr-muted">Our group</dt>
                  <dd>
                    <span className="font-semibold text-mr-ink">{preview.our_group_code}</span>
                    <span className="ml-2 text-xs text-mr-muted">{preview.existing_codes.length ? `${preview.existing_codes.join(", ")} already on this date` : "first group on this date"}</span>
                  </dd>
                  <dt className="text-mr-muted">Filed as</dt>
                  <dd className="break-all font-mono text-xs text-mr-ink">{preview.our_reference}.pdf</dd>
                </dl>
                {preview.duplicate && (
                  <p className="mt-3 flex items-center gap-2 text-xs text-mr-warning">
                    <AlertTriangle className="size-4" /> This partner code was already uploaded as {preview.duplicate.group_code}. Uploading again creates another group; to replace the file, use the group&rsquo;s menu instead.
                  </p>
                )}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="b2b_entry">Entry port</Label>
                <Input id="b2b_entry" list="china-ports-b2b" value={form.entry_port} onChange={(e) => setForm({ ...form, entry_port: e.target.value })} placeholder="Optional now, needed for the visa" autoComplete="off" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="b2b_exit">Exit port</Label>
                <Input id="b2b_exit" list="china-ports-b2b" value={form.exit_port} onChange={(e) => setForm({ ...form, exit_port: e.target.value })} placeholder="Optional now, needed for the visa" autoComplete="off" />
              </div>
              <datalist id="china-ports-b2b">
                {CHINA_PORTS.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
              <div className="space-y-1.5">
                <Label htmlFor="b2b_package">Package</Label>
                <Select value={form.package_tier ?? "none"} onValueChange={(v) => setForm({ ...form, package_tier: v === "none" ? null : v })}>
                  <SelectTrigger id="b2b_package" className="w-full rounded-lg">
                    <SelectValue placeholder="No package" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No package</SelectItem>
                    {PACKAGE_TIERS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {tierNeedsStars(form.package_tier) && (
                <div className="space-y-1.5">
                  <Label htmlFor="b2b_stars">
                    Hotel class <span className="text-mr-red">*</span>
                  </Label>
                  <HotelStarsSelect id="b2b_stars" value={form.hotel_stars} onChange={(v) => setForm({ ...form, hotel_stars: v })} />
                </div>
              )}
              {tierHasHotel(form.package_tier) ? (
                <div className="space-y-1.5">
                  <Label htmlFor="b2b_hotel">Hotel name{tierNeedsStars(form.package_tier) ? " (optional)" : ""}</Label>
                  <Input id="b2b_hotel" value={form.hotel_name} onChange={(e) => setForm({ ...form, hotel_name: e.target.value })} placeholder="Guangzhou Marriott Tianhe" />
                </div>
              ) : (
                <div className="hidden sm:block" />
              )}
              <div className="space-y-1.5">
                <Label htmlFor="b2b_label">Label</Label>
                <Input id="b2b_label" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder={preview ? `${preview.partner_code} · ${preview.pax} pax` : "Optional"} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="b2b_guide">Guide</Label>
                <Input id="b2b_guide" value={form.guide_name} onChange={(e) => setForm({ ...form, guide_name: e.target.value })} placeholder="Optional" />
              </div>
            </div>
          </fieldset>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false);
                reset();
              }}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button onClick={submit} disabled={busy || !file || !preview}>
              {busy ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
              {uploading ? "Uploading…" : preview ? `Create ${preview.our_group_code} and file pack` : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Swap the partner pack on an existing B2B group. */
export function ReplaceB2bPackButton({ groupId, label = "Replace pack" }: { groupId: string; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(f: File | undefined) {
    if (!acceptPdf(f)) return;
    setBusy(true);
    try {
      const path = await uploadIncoming(f);
      const res = await replaceB2bPack(groupId, path);
      if (!res.ok) throw new Error(res.error);
      toast.success(`Pack replaced: ${res.data.reference}.pdf`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not replace the pack");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <Button variant="outline" size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>
        {busy ? <Loader2 className="animate-spin" /> : <Upload />} {label}
      </Button>
    </>
  );
}
