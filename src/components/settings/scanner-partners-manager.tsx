"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, KeyRound, Loader2, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Chip } from "@/components/shared/chip";
import { createScannerPartner, rotateScannerPartnerKey, setScannerPartnerActive, type ScannerPartnerRow } from "@/lib/actions/transfer-vouchers";
import { formatDateTime } from "@/lib/format";

export function ScannerPartnersManager({ partners }: { partners: ScannerPartnerRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<{ code: string; name: string } | null>(null);
  const [issued, setIssued] = useState<{ name: string; key: string } | null>(null);
  const scanUrl = typeof window !== "undefined" ? `${window.location.origin}/scan` : "/scan";

  function create() {
    if (!draft) return;
    startTransition(async () => {
      const res = await createScannerPartner(draft);
      if (!res.ok) return void toast.error(res.error);
      setIssued({ name: draft.name, key: res.data.access_key });
      setDraft(null);
      router.refresh();
    });
  }

  function rotate(p: ScannerPartnerRow) {
    if (!confirm(`Issue a new access key for ${p.name}? Their current key stops working immediately.`)) return;
    startTransition(async () => {
      const res = await rotateScannerPartnerKey(p.id);
      if (!res.ok) return void toast.error(res.error);
      setIssued({ name: p.name, key: res.data.access_key });
    });
  }

  function toggle(p: ScannerPartnerRow, active: boolean) {
    startTransition(async () => {
      const res = await setScannerPartnerActive(p.id, active);
      if (!res.ok) return void toast.error(res.error);
      toast.success(`${p.name} ${active ? "activated" : "deactivated"}`);
      router.refresh();
    });
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied");
    } catch {
      toast.error("Copy failed; select the text and copy it by hand");
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-mr-body">
          Scanner link for partners: <span className="font-mono text-xs">{scanUrl}</span>
          <Button type="button" variant="ghost" size="xs" className="ml-1" onClick={() => copy(scanUrl)}>
            <Copy /> Copy
          </Button>
        </p>
        <Button type="button" onClick={() => setDraft({ code: "", name: "" })}>
          <Plus /> Add partner
        </Button>
      </div>
      {partners.length === 0 ? (
        <p className="rounded-lg border border-dashed border-mr-line px-4 py-6 text-center text-sm text-mr-muted">No scanner partners yet. Add the Hong Kong ground partner and send them their access key.</p>
      ) : (
        <ul className="divide-y divide-mr-line rounded-lg border border-mr-line bg-white">
          {partners.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-medium text-mr-ink">
                  {p.code} · {p.name}
                  {!p.active && <Chip tone="muted">Inactive</Chip>}
                </p>
                <p className="text-xs text-mr-muted">{p.last_seen_at ? `Last scan sign-in ${formatDateTime(p.last_seen_at)}` : "Never signed in"}</p>
              </div>
              <Button type="button" variant="outline" size="xs" disabled={pending} onClick={() => rotate(p)}>
                <RefreshCw /> New key
              </Button>
              <label className="flex items-center gap-2 text-xs text-mr-body">
                <Switch checked={p.active} disabled={pending} onCheckedChange={(v) => toggle(p, v)} /> Active
              </label>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!draft} onOpenChange={(o) => !o && !pending && setDraft(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New scanner partner</DialogTitle>
            <DialogDescription>An access key is generated and shown once. Send it to the partner together with the scanner link.</DialogDescription>
          </DialogHeader>
          {draft && (
            <fieldset disabled={pending} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="sp_code">Code</Label>
                <Input id="sp_code" value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })} placeholder="HKT" autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sp_name">Name</Label>
                <Input id="sp_name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Hong Kong Transfers Ltd" />
              </div>
            </fieldset>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button type="button" disabled={pending || !draft?.code.trim() || !draft?.name.trim()} onClick={create}>
              {pending ? <Loader2 className="animate-spin" /> : <KeyRound />} Create and show key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!issued} onOpenChange={(o) => !o && setIssued(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Access key for {issued?.name}</DialogTitle>
            <DialogDescription>This is the only time the key is shown. Only its hash is stored; issue a new key if it is lost.</DialogDescription>
          </DialogHeader>
          <p className="select-all break-all rounded-md border border-mr-line bg-mr-surface px-3 py-2 font-mono text-sm">{issued?.key}</p>
          <p className="text-xs text-mr-muted">
            Scanner link: <span className="font-mono">{scanUrl}</span>
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => issued && copy(`${scanUrl}\nAccess key: ${issued.key}`)}>
              <Copy /> Copy link + key
            </Button>
            <Button type="button" onClick={() => setIssued(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
