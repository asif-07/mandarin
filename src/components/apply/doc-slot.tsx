"use client";

import { useRef, useState } from "react";
import { CheckCircle2, Eye, FileText, Loader2, RefreshCw, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import type { ApplicantDoc, PORTAL_DOCS } from "@/lib/apply/shared";
import { formatDateTime, formatFileSize } from "@/lib/format";
import { cn } from "@/lib/utils";

export const ACCEPT = ".pdf,.jpg,.jpeg,.png,.heic,.heif";

/** Upload one file into a passenger's slot through the portal API. Resolves with the stored document. */
export async function uploadPortalDocument(token: string, travellerId: string, docType: string, file: File): Promise<UploadedDoc> {
  const fd = new FormData();
  fd.set("file", file);
  fd.set("doc_type", docType);
  fd.set("traveller_id", travellerId);
  const res = await fetch(`/api/apply/${token}/documents`, { method: "POST", body: fd });
  const body = (await res.json().catch(() => ({}))) as { error?: string; document?: ApplicantDoc; replaced?: boolean; replaced_at?: string | null; par_answer?: string | null };
  if (!res.ok || !body.document) throw new Error(body.error ?? "Upload failed");
  return { ...body.document, replaced: !!body.replaced, replaced_at: body.replaced_at ?? null, par_answer: body.par_answer ?? null };
}
export type UploadedDoc = ApplicantDoc & { replaced: boolean; replaced_at: string | null; par_answer: string | null };

/** One upload slot on a passenger card. */
export function DocSlot({ token, travellerId, spec, doc, onUploaded, onRemoved, onUploadedFile, compact = false, locked = false }: { token: string; travellerId: string; spec: (typeof PORTAL_DOCS)[number]; doc?: ApplicantDoc; onUploaded: (doc: UploadedDoc) => void; onRemoved: (docId: string) => void; onUploadedFile?: (file: File, doc: ApplicantDoc) => void; compact?: boolean; locked?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    try {
      const d = await uploadPortalDocument(token, travellerId, spec.type, file);
      onUploaded(d);
      toast.success(d.replaced ? `${spec.title} replaced on ${formatDateTime(d.replaced_at ?? d.uploaded_at)}. The previous copy is kept with its timestamp.` : `${spec.title} uploaded`);
      onUploadedFile?.(file, d);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
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
      onRemoved(doc.id);
    } finally {
      setBusy(false);
    }
  }

  const h = compact ? "h-16" : "h-24";
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
        <div className={cn(h, "flex items-center justify-center gap-2 text-sm text-mr-body")}>
          <Loader2 className="size-4 animate-spin" /> Uploading…
        </div>
      ) : doc ? (
        <div>
          {doc.preview_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={doc.preview_url} alt="" className={cn(h, "w-full rounded-md border border-mr-line object-cover")} />
          ) : (
            <div className={cn(h, "flex items-center justify-center rounded-md border border-mr-line bg-mr-surface text-mr-muted")}>
              <FileText className="size-5" /> <span className="ml-2 text-xs font-medium">PDF</span>
            </div>
          )}
          <p className="mt-1 truncate text-xs text-mr-body" title={doc.file_name}>
            {doc.file_name} · {formatFileSize(doc.file_size)}
          </p>
          {doc.uploaded_at && <p className="text-[11px] text-mr-muted">Uploaded {formatDateTime(doc.uploaded_at)}</p>}
          <div className="mt-1 flex items-center gap-1">
            <a href={`/api/apply/${token}/documents/${doc.id}`} target="_blank" rel="noopener" className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-mr-body hover:bg-mr-surface hover:text-mr-ink">
              <Eye className="size-3.5" /> View
            </a>
            <button type="button" onClick={() => inputRef.current?.click()} className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-mr-body hover:bg-mr-surface hover:text-mr-ink">
              <RefreshCw className="size-3.5" /> Replace
            </button>
            {!locked && (
              <button type="button" onClick={remove} className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-mr-body hover:bg-mr-surface hover:text-mr-red">
                <Trash2 className="size-3.5" /> Remove
              </button>
            )}
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()} className={cn(h, "flex w-full flex-col items-center justify-center gap-1 rounded-md text-mr-muted hover:text-mr-ink")}>
          <UploadCloud className="size-5" />
          <span className="text-xs">Tap to upload or take a photo</span>
          {!compact && <span className="text-[10px]">PDF, JPG, PNG, HEIC · max 15 MB</span>}
        </button>
      )}
      {!compact && <p className="mt-2 text-[11px] leading-snug text-mr-muted">{spec.hint}</p>}
    </div>
  );
}
