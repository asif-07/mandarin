"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { submitPartnerGroup } from "@/lib/actions/partner-portal";

/** Upload the bulk traveller PDF (multipart to the portal API) and submit the group. */
export function PartnerGroupActions({ groupId, mode, hasPack }: { groupId: string; mode: "upload" | "submit"; hasPack: boolean }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();

  async function upload(file: File) {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch(`/api/partner/groups/${groupId}/pack`, { method: "POST", body: fd });
      const body = (await res.json().catch(() => ({}))) as { error?: string; file_name?: string };
      if (!res.ok) return void toast.error(body.error ?? "Upload failed");
      toast.success(`Uploaded ${body.file_name ?? file.name}`);
      router.refresh();
    } catch {
      toast.error("No connection. The file was not uploaded.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  if (mode === "upload") {
    return (
      <>
        <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
        <Button type="button" size="xs" variant={hasPack ? "outline" : "default"} disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? <Loader2 className="animate-spin" /> : <FileUp />} {hasPack ? "Replace PDF" : "Upload documents PDF"}
        </Button>
      </>
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs text-mr-muted">{hasPack ? "Everything in place? Submit for CTS approval." : "Upload the traveller documents PDF to enable submission."}</p>
      <Button
        type="button"
        disabled={pending || !hasPack}
        onClick={() =>
          startTransition(async () => {
            const res = await submitPartnerGroup(groupId);
            if (!res.ok) return void toast.error(res.error, { duration: 10000 });
            toast.success("Group submitted. The company has been notified.");
            router.refresh();
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" /> : <Send />} Submit group
      </Button>
    </div>
  );
}
