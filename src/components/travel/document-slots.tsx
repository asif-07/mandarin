"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Eye, FileText, Loader2, Plus, RefreshCw, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { createClient } from "@/lib/supabase/client";
import { deleteDocument, getDocumentUrl, registerDocument } from "@/lib/actions/documents";
import { ACCEPTED_EXT, checkUploadFile, guessDocType } from "@/lib/validation/travel";
import { BUCKETS, DOC_TYPES, TRAVELLER_STATUSES, labelFor, type DocType } from "@/lib/constants";
import { formatDateTime, formatFileSize } from "@/lib/format";
import { cn } from "@/lib/utils";

export type DocView = {
  id: string;
  doc_type: string;
  file_name: string;
  file_size: number | null;
  mime_type: string;
  uploaded_at: string | null;
  uploaded_by_name: string | null;
  preview_url: string | null;
};

type PendingFile = { file: File; mime: string; docType: DocType | "" };

const ACCEPT = ACCEPTED_EXT.join(",");

function storagePath(travellerId: string, docType: string, fileName: string) {
  const safe = fileName.replace(/[^\w.\-]+/g, "_").slice(-120);
  return `${travellerId}/${docType}/${crypto.randomUUID()}-${safe}`;
}

export function DocumentSlots({ travellerId, documents }: { travellerId: string; documents: DocView[] }) {
  const router = useRouter();
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [dragOver, setDragOver] = useState(false);
  const [assign, setAssign] = useState<PendingFile[] | null>(null);
  const [assignBusy, setAssignBusy] = useState(false);

  const required = DOC_TYPES.filter((d) => d.required);
  const filled = required.filter((d) => documents.some((doc) => doc.doc_type === d.value)).length;
  const others = documents.filter((d) => d.doc_type === "other");

  async function uploadOne(file: File, mime: string, docType: string) {
    setUploading((u) => ({ ...u, [docType]: true }));
    try {
      const path = storagePath(travellerId, docType, file.name);
      const supabase = createClient();
      const { error } = await supabase.storage
        .from(BUCKETS.travellerDocuments)
        .upload(path, file, { contentType: mime, upsert: false });
      if (error) throw new Error(error.message);
      const result = await registerDocument(travellerId, {
        doc_type: docType,
        file_name: file.name,
        storage_path: path,
        mime_type: mime,
        file_size: file.size,
      });
      if (!result.ok) throw new Error(result.error);
      toast.success(`${labelFor(DOC_TYPES, docType)} uploaded`);
      if (result.data.newStatus === "documents_complete") {
        toast.success("All four documents are in. Status moved to Documents Complete.", { duration: 6000 });
      }
    } catch (e) {
      toast.error(`Upload failed: ${e instanceof Error ? e.message : "unknown error"}`);
    } finally {
      setUploading((u) => ({ ...u, [docType]: false }));
    }
  }

  function handleFiles(files: FileList | File[], forcedType?: DocType) {
    const list = Array.from(files);
    const accepted: PendingFile[] = [];
    for (const file of list) {
      const check = checkUploadFile(file);
      if (!check.ok) {
        toast.error(check.error);
        continue;
      }
      accepted.push({ file, mime: check.mime, docType: forcedType ?? ((guessDocType(file.name) as DocType | null) ?? "") });
    }
    if (accepted.length === 0) return;
    if (forcedType && accepted.length === 1) {
      void uploadOne(accepted[0]!.file, accepted[0]!.mime, forcedType).then(() => router.refresh());
      return;
    }
    setAssign(accepted);
  }

  async function confirmAssign() {
    if (!assign) return;
    if (assign.some((a) => !a.docType)) return void toast.error("Choose a slot for every file");
    setAssignBusy(true);
    for (const a of assign) await uploadOne(a.file, a.mime, a.docType);
    setAssignBusy(false);
    setAssign(null);
    router.refresh();
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
      }}
      className={cn("rounded-lg transition-colors", dragOver && "bg-mr-surface ring-2 ring-mr-ink ring-offset-2")}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-mr-ink">
            {filled} of {required.length} documents uploaded
          </span>
          <Progress value={(filled / required.length) * 100} className="h-1.5 w-32" aria-label="Document progress" />
        </div>
        <label className="cursor-pointer text-xs text-mr-body hover:text-mr-ink">
          <input type="file" multiple accept={ACCEPT} className="sr-only" onChange={(e) => e.target.files && handleFiles(e.target.files)} />
          Drop several files anywhere, or <span className="underline">choose files</span> and assign them
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {required.map((slot) => {
          const doc = documents.find((d) => d.doc_type === slot.value);
          return (
            <SlotCard
              key={slot.value}
              label={slot.label}
              doc={doc}
              busy={!!uploading[slot.value]}
              onFiles={(files) => handleFiles(files, slot.value)}
              onDeleted={() => router.refresh()}
            />
          );
        })}
      </div>

      <div className="mt-3 rounded-lg border border-mr-line p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-mr-ink">Other documents</span>
          <label className={cn("inline-flex cursor-pointer items-center gap-1 text-xs text-mr-body hover:text-mr-ink", uploading.other && "pointer-events-none opacity-50")}>
            <input type="file" multiple accept={ACCEPT} className="sr-only" onChange={(e) => e.target.files && handleFiles(e.target.files, "other")} />
            {uploading.other ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />} Add
          </label>
        </div>
        {others.length === 0 ? (
          <p className="mt-1 text-xs text-mr-muted">Optional extras (insurance, ID copies) are appended after the four required documents.</p>
        ) : (
          <ul className="mt-2 divide-y divide-mr-line">
            {others.map((doc) => (
              <li key={doc.id} className="flex items-center gap-3 py-2">
                <Thumb doc={doc} small />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{doc.file_name}</p>
                  <p className="text-xs text-mr-muted">
                    {formatFileSize(doc.file_size)}
                    {doc.uploaded_by_name ? ` · ${doc.uploaded_by_name}` : ""} · {formatDateTime(doc.uploaded_at)}
                  </p>
                </div>
                <DocActions doc={doc} onDeleted={() => router.refresh()} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={!!assign} onOpenChange={(o) => !o && !assignBusy && setAssign(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign files to slots</DialogTitle>
            <DialogDescription>Slots were guessed from the file names. Correct any that are wrong, then confirm.</DialogDescription>
          </DialogHeader>
          <ul className="max-h-[50vh] space-y-2 overflow-y-auto">
            {assign?.map((a, i) => (
              <li key={i} className="flex items-center gap-3">
                <span className="min-w-0 flex-1 truncate text-sm" title={a.file.name}>
                  {a.file.name}
                  <span className="ml-1 text-xs text-mr-muted">{formatFileSize(a.file.size)}</span>
                </span>
                <Select
                  value={a.docType}
                  onValueChange={(v) => setAssign((prev) => prev!.map((p, j) => (j === i ? { ...p, docType: v as DocType } : p)))}
                  disabled={assignBusy}
                >
                  <SelectTrigger className="w-[150px] rounded-lg" aria-label={`Slot for ${a.file.name}`}>
                    <SelectValue placeholder="Choose slot" />
                  </SelectTrigger>
                  <SelectContent>
                    {DOC_TYPES.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssign(null)} disabled={assignBusy}>
              Cancel
            </Button>
            <Button onClick={confirmAssign} disabled={assignBusy}>
              {assignBusy && <Loader2 className="animate-spin" />} Upload {assign?.length ?? 0} file{assign?.length === 1 ? "" : "s"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Thumb({ doc, small }: { doc: DocView; small?: boolean }) {
  const size = small ? "size-10" : "h-28 w-full";
  if (doc.preview_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={doc.preview_url} alt="" className={cn(size, "rounded-md border border-mr-line object-cover")} />;
  }
  return (
    <div className={cn(size, "flex items-center justify-center rounded-md border border-mr-line bg-mr-surface text-mr-muted")}>
      <FileText className={small ? "size-4" : "size-6"} />
      {!small && <span className="ml-2 text-xs font-medium">PDF</span>}
    </div>
  );
}

function DocActions({ doc, onDeleted, onReplace }: { doc: DocView; onDeleted: () => void; onReplace?: () => void }) {
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);

  function view() {
    startTransition(async () => {
      const result = await getDocumentUrl(doc.id);
      if (!result.ok) return void toast.error(result.error);
      window.open(result.data.url, "_blank", "noopener");
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteDocument(doc.id);
      setConfirm(false);
      if (!result.ok) return void toast.error(result.error);
      toast.success("Document removed");
      if (result.data.newStatus === "documents_pending") toast.warning("Status moved back to Documents Pending");
      onDeleted();
    });
  }

  return (
    <div className="flex items-center gap-0.5">
      <Button variant="ghost" size="icon-sm" aria-label="View" onClick={view} disabled={pending}>
        <Eye />
      </Button>
      {onReplace && (
        <Button variant="ghost" size="icon-sm" aria-label="Replace" onClick={onReplace} disabled={pending}>
          <RefreshCw />
        </Button>
      )}
      <Button variant="ghost" size="icon-sm" aria-label="Delete" onClick={() => setConfirm(true)} disabled={pending}>
        <Trash2 />
      </Button>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Remove ${doc.file_name}?`}
        description="The file stays in storage for the audit trail but will no longer be used in travel packs."
        confirmLabel="Remove"
        destructive
        pending={pending}
        onConfirm={remove}
      />
    </div>
  );
}

function SlotCard({
  label,
  doc,
  busy,
  onFiles,
  onDeleted,
}: {
  label: string;
  doc?: DocView;
  busy: boolean;
  onFiles: (files: FileList) => void;
  onDeleted: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-lg border p-3 transition-colors",
        doc ? "border-mr-line" : "border-dashed border-mr-line",
        over && "border-mr-ink bg-mr-surface",
      )}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOver(false);
        if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
      }}
    >
      <input ref={inputRef} type="file" accept={ACCEPT} className="sr-only" onChange={(e) => e.target.files && onFiles(e.target.files)} />
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-mr-ink">{label}</span>
        {doc ? (
          <CheckCircle2 className="size-4 text-mr-success" aria-label="Uploaded" />
        ) : (
          <span className="size-4 rounded-full border-2 border-mr-line" aria-label="Missing" />
        )}
      </div>

      {busy ? (
        <div className="flex h-28 items-center justify-center gap-2 text-sm text-mr-body">
          <Loader2 className="size-4 animate-spin" /> Uploading…
        </div>
      ) : doc ? (
        <>
          <Thumb doc={doc} />
          <p className="mt-2 truncate text-xs font-medium text-mr-ink" title={doc.file_name}>
            {doc.file_name}
          </p>
          <p className="text-[11px] text-mr-muted">
            {formatFileSize(doc.file_size)}
            {doc.uploaded_by_name ? ` · ${doc.uploaded_by_name}` : ""}
          </p>
          <p className="text-[11px] text-mr-muted">{formatDateTime(doc.uploaded_at)}</p>
          <div className="mt-1 -ml-2">
            <DocActions doc={doc} onDeleted={onDeleted} onReplace={() => inputRef.current?.click()} />
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex h-28 w-full flex-col items-center justify-center gap-1 rounded-md text-mr-muted hover:text-mr-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mr-ink"
        >
          <UploadCloud className="size-5" />
          <span className="text-xs">Drop file or click to upload</span>
          <span className="text-[10px]">PDF, JPG, PNG, HEIC · max 15 MB</span>
        </button>
      )}
    </div>
  );
}

export function travellerStatusLabel(status: string) {
  return labelFor(TRAVELLER_STATUSES, status);
}
