"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, FileCheck2, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { createClient } from "@/lib/supabase/client";
import { deleteGroupDocument, registerGroupDocument, type GroupDocument } from "@/lib/actions/documents";
import { checkUploadFile, ACCEPTED_EXT } from "@/lib/validation/travel";
import { BUCKETS, GROUP_DOC_TYPES } from "@/lib/constants";
import { formatFileSize } from "@/lib/format";
import { cn } from "@/lib/utils";

export type GroupDocView = Pick<GroupDocument, "id" | "doc_type" | "file_name" | "file_size" | "uploaded_at">;

function GroupSlot({ groupId, type, label, doc }: { groupId: string; type: string; label: string; doc?: GroupDocView }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    const check = checkUploadFile(file);
    if (!check.ok) return void toast.error(check.error);
    setBusy(true);
    try {
      const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(-120);
      const path = `_groups/${groupId}/${type}/${crypto.randomUUID()}-${safe}`;
      const supabase = createClient();
      const { error } = await supabase.storage.from(BUCKETS.travellerDocuments).upload(path, file, { contentType: check.mime, upsert: false });
      if (error) throw new Error(error.message);
      const res = await registerGroupDocument(groupId, { doc_type: type, file_name: file.name, storage_path: path, mime_type: check.mime, file_size: file.size });
      if (!res.ok) throw new Error(res.error);
      toast.success(`${label} uploaded; it now counts for every traveller in the group`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("flex min-w-0 flex-1 items-center gap-2 rounded-md border px-3 py-2", doc ? "border-mr-success/40 bg-mr-success/5" : "border-dashed border-mr-line")}>
      <FileCheck2 className={cn("size-4 shrink-0", doc ? "text-mr-success" : "text-mr-muted")} />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-mr-ink">{label}</p>
        <p className="truncate text-[11px] text-mr-muted">{doc ? `${doc.file_name}${doc.file_size ? ` · ${formatFileSize(doc.file_size)}` : ""}` : "Not uploaded · each traveller needs their own"}</p>
      </div>
      <input
        ref={ref}
        type="file"
        accept={ACCEPTED_EXT.join(",")}
        className="hidden"
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {doc && (
        <a href={`/api/group-docs/${doc.id}`} className={buttonVariants({ variant: "ghost", size: "icon-sm" })} aria-label={`Download ${label}`}>
          <Download />
        </a>
      )}
      <Button variant="ghost" size="icon-sm" aria-label={doc ? `Replace ${label}` : `Upload ${label}`} disabled={busy} onClick={() => ref.current?.click()}>
        {busy ? <Loader2 className="animate-spin" /> : <Upload />}
      </Button>
      {doc && (
        <>
          <Button variant="ghost" size="icon-sm" aria-label={`Remove ${label}`} disabled={pending} onClick={() => setConfirm(true)}>
            <Trash2 />
          </Button>
          <ConfirmDialog
            open={confirm}
            onOpenChange={setConfirm}
            title={`Remove the ${label.toLowerCase()}?`}
            description="Travellers without their own copy go back to needing one."
            confirmLabel="Remove"
            destructive
            pending={pending}
            onConfirm={() =>
              startTransition(async () => {
                const res = await deleteGroupDocument(doc.id);
                setConfirm(false);
                if (!res.ok) return void toast.error(res.error);
                toast.success(`${label} removed`);
                router.refresh();
              })
            }
          />
        </>
      )}
    </div>
  );
}

/** Group-level flight ticket and hotel booking slots. */
export function GroupDocuments({ groupId, documents }: { groupId: string; documents: GroupDocView[] }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      {GROUP_DOC_TYPES.map((t) => (
        <GroupSlot key={t.value} groupId={groupId} type={t.value} label={t.label} doc={documents.find((d) => d.doc_type === t.value)} />
      ))}
    </div>
  );
}
