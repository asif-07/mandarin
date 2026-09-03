"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileStack, Loader2, Package } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { formatDateTime } from "@/lib/format";

async function requestPack(url: string): Promise<{ url: string; page_count?: number }> {
  const res = await fetch(url, { method: "POST" });
  const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string; page_count?: number };
  if (!res.ok || !body.url) throw new Error(body.error ?? `Request failed (${res.status})`);
  return { url: body.url, page_count: body.page_count };
}

export function CompilePackButton({ travellerId, missing }: { travellerId: string; missing: string[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  async function compile() {
    setConfirm(false);
    setBusy(true);
    try {
      const { url, page_count } = await requestPack(`/api/travellers/${travellerId}/pack`);
      toast.success(`Travel pack ready${page_count ? ` (${page_count} pages)` : ""}. Downloading…`);
      window.location.assign(url);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not compile the travel pack");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button onClick={() => (missing.length ? setConfirm(true) : compile())} disabled={busy}>
        {busy ? <Loader2 className="animate-spin" /> : <Package />}
        {busy ? "Compiling…" : "Compile travel pack"}
      </Button>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Some documents are missing"
        description={
          <span>
            The pack will be compiled without: <strong>{missing.join(", ")}</strong>. Continue anyway?
          </span>
        }
        confirmLabel="Compile anyway"
        onConfirm={compile}
      />
    </>
  );
}

export function CompileGroupButton({ groupId, travellerCount }: { groupId: string; travellerCount: number }) {
  const [busy, setBusy] = useState(false);

  async function compile() {
    setBusy(true);
    try {
      const { url } = await requestPack(`/api/groups/${groupId}/packs`);
      toast.success("ZIP ready. Downloading…");
      window.location.assign(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not compile the group packs");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={compile} disabled={busy || travellerCount === 0}>
      {busy ? <Loader2 className="animate-spin" /> : <FileStack />}
      {busy ? "Compiling…" : "Compile all packs (ZIP)"}
    </Button>
  );
}

export type PackRow = {
  id: string;
  generated_at: string | null;
  generated_by_name: string | null;
  page_count: number | null;
  included_count: number;
};

export function PackHistory({ packs }: { packs: PackRow[] }) {
  if (packs.length === 0) return <p className="text-sm text-mr-muted">No travel pack compiled yet.</p>;
  return (
    <ul className="divide-y divide-mr-line">
      {packs.map((p, i) => (
        <li key={p.id} className="flex items-center gap-3 py-2 text-sm">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-mr-ink">
              {formatDateTime(p.generated_at)} {i === 0 && <span className="ml-1 rounded-md bg-mr-surface px-1.5 py-0.5 text-[11px] text-mr-body">latest</span>}
            </p>
            <p className="text-xs text-mr-muted">
              {p.generated_by_name ? `${p.generated_by_name} · ` : ""}
              {p.page_count ? `${p.page_count} pages · ` : ""}
              {p.included_count} document{p.included_count === 1 ? "" : "s"}
            </p>
          </div>
          <a href={`/api/packs/${p.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-mr-ink hover:underline">
            <Download className="size-3.5" /> Download
          </a>
        </li>
      ))}
    </ul>
  );
}
