"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, FileCheck2, Loader2, Stamp, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusPill } from "@/components/shared/status-pill";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { createClient } from "@/lib/supabase/client";
import { clearGroupVisa } from "@/lib/actions/travel-groups";
import { BUCKETS, VISA_STATUSES, labelFor } from "@/lib/constants";
import { checkUploadFile, ACCEPTED_EXT } from "@/lib/validation/travel";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export type GroupVisaInfo = {
  id: string;
  source: string;
  partner_code: string | null;
  visa_status: string;
  visa_applied_at: string | null;
  visa_uploaded_at: string | null;
  visa_path: string | null;
  pack_path: string | null;
  traveller_count: number;
  partner_has_logo?: boolean;
};

const TONES = { pending: "neutral", applied: "warning", approved: "success" } as const;

export function VisaStatusPill({ group, className }: { group: Pick<GroupVisaInfo, "visa_status" | "visa_applied_at" | "visa_uploaded_at">; className?: string }) {
  const tone = TONES[group.visa_status as keyof typeof TONES] ?? "neutral";
  const when = group.visa_status === "approved" ? group.visa_uploaded_at : group.visa_status === "applied" ? group.visa_applied_at : null;
  return <StatusPill label={`${labelFor(VISA_STATUSES, group.visa_status)}${when ? ` · ${formatDate(when)}` : ""}`} tone={tone} className={className} />;
}

/**
 * PDFs go straight to the travel-packs bucket; photos go to the
 * traveller-documents bucket (travel-packs is PDF-only) and the server turns
 * them into a one-page PDF when filing.
 */
async function uploadIncomingVisa(file: File, mime: string): Promise<string> {
  const supabase = createClient();
  const isPdf = mime === "application/pdf";
  const ext = isPdf ? "pdf" : (file.name.toLowerCase().match(/\.(jpe?g|png|heic|heif)$/)?.[1] ?? "jpg");
  const path = `_visa/incoming/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(isPdf ? BUCKETS.travelPacks : BUCKETS.travellerDocuments).upload(path, file, { contentType: mime, upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

/** Upload the received visa page (PDF or photo) for a group. */
export function UploadVisaButton({ groupId, replace = false, size = "sm" }: { groupId: string; replace?: boolean; size?: "sm" | "default" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  async function onFile(f: File | undefined) {
    if (!f) return;
    const check = checkUploadFile(f);
    if (!check.ok) return void toast.error(check.error);
    setBusy(true);
    try {
      const path = await uploadIncomingVisa(f, check.mime);
      const r = await fetch(`/api/groups/${groupId}/visa`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ upload_path: path, original_name: f.name, mime_type: check.mime }) });
      const data = (await r.json().catch(() => ({}))) as { file_name?: string; error?: string };
      if (!r.ok) throw new Error(data.error ?? `Upload failed (${r.status})`);
      toast.success(`Visa filed as ${data.file_name ?? f.name}`, { duration: 6000 });
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not upload the visa");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
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
      <Button variant={replace ? "outline" : "default"} size={size} disabled={busy} title="PDF or a photo (JPG, PNG, HEIC); photos are filed as a one-page PDF" onClick={() => ref.current?.click()}>
        {busy ? <Loader2 className="animate-spin" /> : replace ? <Upload /> : <Stamp />} {replace ? "Replace visa" : "Upload visa"}
      </Button>
    </>
  );
}

/**
 * "Download visa + documents". Our groups download straight away with the
 * Mandarin Roots cover; B2B groups first ask which logo goes on the cover.
 */
export function DownloadBundleButton({ group, size = "sm", variant = "outline" }: { group: GroupVisaInfo; size?: "sm" | "default"; variant?: "default" | "outline" }) {
  const [open, setOpen] = useState(false);
  const [logo, setLogo] = useState<"partner" | "none" | "mr">(group.partner_has_logo ? "partner" : "none");
  const isB2b = group.source === "b2b";
  const canBuild = isB2b ? !!group.pack_path : group.traveller_count > 0;
  const label = group.visa_path ? "Download visa + documents" : "Download documents";

  if (!canBuild) return null;
  if (!isB2b) {
    return (
      <a href={`/api/groups/${group.id}/bundle`} className={buttonVariants({ variant, size })}>
        <Download /> {label}
      </a>
    );
  }
  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        <Download /> {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cover page branding</DialogTitle>
            <DialogDescription>This is a partner group ({group.partner_code}). Choose what appears on the first page before the {group.visa_path ? "visa and " : ""}documents.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {(
              [
                { value: "partner", title: `${group.partner_code} logo`, hint: group.partner_has_logo ? "Their logo, no Mandarin Roots branding" : "No logo on file yet: their name is printed instead. Add one under Partners on the B2B page." },
                { value: "none", title: "No logo", hint: `Plain cover with the partner name ${group.partner_code} only` },
                { value: "mr", title: "Mandarin Roots logo", hint: "Our standard branded cover" },
              ] as const
            ).map((o) => (
              <label key={o.value} className={cn("flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm", logo === o.value ? "border-mr-ink bg-mr-surface" : "border-mr-line")}>
                <input type="radio" name="logo" value={o.value} checked={logo === o.value} onChange={() => setLogo(o.value)} className="mt-1" />
                <span>
                  <span className="block font-medium text-mr-ink">{o.title}</span>
                  <span className="block text-xs text-mr-muted">{o.hint}</span>
                </span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <a href={`/api/groups/${group.id}/bundle?logo=${logo}`} className={buttonVariants()} onClick={() => setOpen(false)}>
              <Download /> Download
            </a>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Status line plus the visa actions for a group card. */
export function GroupVisaPanel({ group }: { group: GroupVisaInfo }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmClear, setConfirmClear] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <VisaStatusPill group={group} />
      {group.visa_path ? (
        <>
          <a href={`/api/groups/${group.id}/visa`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            <FileCheck2 /> Download visa
          </a>
          <UploadVisaButton groupId={group.id} replace />
          <Button variant="ghost" size="icon-sm" aria-label="Remove visa" disabled={pending} onClick={() => setConfirmClear(true)}>
            <Trash2 />
          </Button>
          <ConfirmDialog
            open={confirmClear}
            onOpenChange={setConfirmClear}
            title="Remove the uploaded visa?"
            description="The group goes back to visa applied. The file stays in storage."
            confirmLabel="Remove"
            destructive
            pending={pending}
            onConfirm={() =>
              startTransition(async () => {
                const res = await clearGroupVisa(group.id);
                setConfirmClear(false);
                if (!res.ok) return void toast.error(res.error);
                toast.success("Visa removed");
                router.refresh();
              })
            }
          />
        </>
      ) : (
        <UploadVisaButton groupId={group.id} />
      )}
      <DownloadBundleButton group={group} />
    </div>
  );
}
