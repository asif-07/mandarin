"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Chip } from "@/components/shared/chip";
import { issuePartnerPortalKey, setPartnerPortalActive, type PartnerAccessRow } from "@/lib/actions/workflow";
import { formatDateTime } from "@/lib/format";

export function PartnerPortalManager({ partners }: { partners: PartnerAccessRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [issued, setIssued] = useState<{ name: string; key: string } | null>(null);
  const portalUrl = typeof window !== "undefined" ? `${window.location.origin}/partner` : "/partner";

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
      <p className="mb-4 text-sm text-mr-body">
        Portal link for partners: <span className="font-mono text-xs">{portalUrl}</span>
        <Button type="button" variant="ghost" size="xs" className="ml-1" onClick={() => copy(portalUrl)}>
          <Copy /> Copy
        </Button>
      </p>
      {partners.length === 0 ? (
        <p className="rounded-lg border border-dashed border-mr-line px-4 py-6 text-center text-sm text-mr-muted">No partners yet. Add them from the B2B groups page.</p>
      ) : (
        <ul className="divide-y divide-mr-line rounded-lg border border-mr-line bg-white">
          {partners.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-mr-ink">
                  {p.code}
                  {p.name ? ` · ${p.name}` : ""}
                  {p.has_key ? p.portal_active ? <Chip tone="success">Portal on</Chip> : <Chip tone="muted">Portal off</Chip> : <Chip tone="neutral">No key yet</Chip>}
                </p>
                <p className="text-xs text-mr-muted">
                  {p.email ? `Registered email ${p.email}` : "No registered email: the approved visa cannot be emailed"}
                  {p.portal_last_seen_at ? ` · last sign-in ${formatDateTime(p.portal_last_seen_at)}` : ""}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="xs"
                disabled={pending}
                onClick={() => {
                  if (p.has_key && !confirm(`Issue a new key for ${p.code}? Their current key stops working.`)) return;
                  startTransition(async () => {
                    const res = await issuePartnerPortalKey(p.id);
                    if (!res.ok) return void toast.error(res.error);
                    setIssued({ name: p.name ?? p.code, key: res.data.access_key });
                    router.refresh();
                  });
                }}
              >
                <KeyRound /> {p.has_key ? "New key" : "Issue key"}
              </Button>
              {p.has_key && (
                <label className="flex items-center gap-2 text-xs text-mr-body">
                  <Switch
                    checked={p.portal_active}
                    disabled={pending}
                    onCheckedChange={(v) =>
                      startTransition(async () => {
                        const res = await setPartnerPortalActive(p.id, v);
                        if (!res.ok) return void toast.error(res.error);
                        router.refresh();
                      })
                    }
                  />
                  Active
                </label>
              )}
            </li>
          ))}
        </ul>
      )}
      <Dialog open={!!issued} onOpenChange={(o) => !o && setIssued(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Portal access key for {issued?.name}</DialogTitle>
            <DialogDescription>Shown once. Only its hash is stored; issue a new key if it is lost.</DialogDescription>
          </DialogHeader>
          <p className="select-all break-all rounded-md border border-mr-line bg-mr-surface px-3 py-2 font-mono text-sm">{issued?.key}</p>
          <p className="text-xs text-mr-muted">
            Portal: <span className="font-mono">{portalUrl}</span>
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => issued && copy(`${portalUrl}\nAccess key: ${issued.key}`)}>
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
