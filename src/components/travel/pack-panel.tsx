"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileStack, Loader2, Package } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DOC_TYPES, labelFor } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

async function requestPack(url: string, docs?: string[]): Promise<{ url: string; page_count?: number; file_name?: string; warnings?: string[] }> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(docs ? { docs } : {}) });
  const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string; page_count?: number; file_name?: string; warnings?: string[] };
  if (!res.ok || !body.url) throw new Error(body.error ?? `Request failed (${res.status})`);
  return { url: body.url, page_count: body.page_count, file_name: body.file_name, warnings: body.warnings };
}

/** Checkbox list of document types for a selective download (PAR only, passport + flight, any combination). */
export function DocTypePicker({ types, selected, onChange, present }: { types: string[]; selected: Set<string>; onChange: (next: Set<string>) => void; present?: Set<string> }) {
  return (
    <ul className="grid gap-1.5 sm:grid-cols-2">
      {types.map((t) => {
        const label = labelFor(DOC_TYPES, t);
        const missing = present ? !present.has(t) : false;
        return (
          <li key={t}>
            <label className={cn("flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-2 text-sm", selected.has(t) ? "border-mr-ink bg-mr-surface" : "border-mr-line", missing && "opacity-60")}>
              <Checkbox
                checked={selected.has(t)}
                onCheckedChange={(v) => {
                  const next = new Set(selected);
                  if (v) next.add(t);
                  else next.delete(t);
                  onChange(next);
                }}
              />
              <span className="flex-1">{label}</span>
              {missing && <span className="text-[11px] text-mr-muted">not uploaded</span>}
            </label>
          </li>
        );
      })}
    </ul>
  );
}

const ALL_TYPES = DOC_TYPES.map((d) => d.value as string);

export function CompilePackButton({ travellerId, missing, available }: { travellerId: string; missing: string[]; available?: string[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const present = new Set(available ?? []);
  const choices = ALL_TYPES.filter((t) => present.has(t));
  const [selected, setSelected] = useState<Set<string>>(() => new Set(choices));

  async function compile() {
    setOpen(false);
    setBusy(true);
    try {
      const all = choices.every((t) => selected.has(t));
      const { url, page_count } = await requestPack(`/api/travellers/${travellerId}/pack`, all ? undefined : [...selected]);
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
      <Button onClick={() => setOpen(true)} disabled={busy}>
        {busy ? <Loader2 className="animate-spin" /> : <Package />}
        {busy ? "Compiling…" : "Compile travel pack"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>What to include</DialogTitle>
            <DialogDescription>
              Any combination: PAR only, passport and flight, everything. The cover page lists what is inside.
              {missing.length > 0 && (
                <>
                  {" "}
                  Not uploaded yet: <strong>{missing.join(", ")}</strong>.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {choices.length === 0 ? <p className="text-sm text-mr-muted">No documents uploaded yet. The pack will be the cover page only.</p> : <DocTypePicker types={choices} selected={selected} onChange={setSelected} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={compile} disabled={choices.length > 0 && selected.size === 0}>
              <Package /> Compile {selected.size && selected.size < choices.length ? `${selected.size} of ${choices.length}` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function CompileGroupButton({ groupId, travellerCount }: { groupId: string; travellerCount: number }) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(ALL_TYPES));

  async function compile() {
    setOpen(false);
    setBusy(true);
    const started = toast.loading(`Compiling ${travellerCount} traveller${travellerCount === 1 ? "" : "s"} into one PDF…`);
    try {
      const all = ALL_TYPES.every((t) => selected.has(t));
      const { url, file_name, page_count, warnings } = await requestPack(`/api/groups/${groupId}/packs`, all ? undefined : [...selected]);
      toast.success(`${file_name ?? "Group PDF"} ready${page_count ? ` (${page_count} pages)` : ""}. Downloading…`, { id: started });
      warnings?.forEach((w) => toast.warning(w, { duration: 8000 }));
      window.location.assign(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not compile the group PDF", { id: started });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} disabled={busy || travellerCount === 0}>
        {busy ? <Loader2 className="animate-spin" /> : <FileStack />}
        {busy ? "Compiling…" : "Compile group PDF"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Which documents for the group PDF</DialogTitle>
            <DialogDescription>One cover for the group, then each traveller&apos;s selected documents. Untick to send, say, only the PARs or only passports.</DialogDescription>
          </DialogHeader>
          <DocTypePicker types={ALL_TYPES} selected={selected} onChange={setSelected} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={compile} disabled={selected.size === 0}>
              <FileStack /> Compile {selected.size < ALL_TYPES.length ? `${selected.size} type${selected.size === 1 ? "" : "s"}` : "all"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
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
