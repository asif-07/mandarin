"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, KeyRound, Loader2, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Chip } from "@/components/shared/chip";
import { createVisaMember, rotateVisaMemberKey, setVisaMemberActive, type VisaMemberRow } from "@/lib/actions/workflow";
import type { GuideRow } from "@/lib/workflow/guides";
import { VISA_TEAM_ROLES, labelFor } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";

export function VisaTeamManager({ members, guides }: { members: VisaMemberRow[]; guides: GuideRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<{ code: string; name: string; role: string; phone: string; guide_id: string | null } | null>(null);
  const [issued, setIssued] = useState<{ name: string; key: string } | null>(null);
  const url = typeof window !== "undefined" ? `${window.location.origin}/visa-team` : "/visa-team";

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied");
    } catch {
      toast.error("Copy failed");
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-mr-body">
          Extension link: <span className="font-mono text-xs">{url}</span>
          <Button type="button" variant="ghost" size="xs" className="ml-1" onClick={() => copy(url)}>
            <Copy /> Copy
          </Button>
        </p>
        <Button type="button" onClick={() => setDraft({ code: "", name: "", role: "visa_processor", phone: "", guide_id: null })}>
          <Plus /> Add member
        </Button>
      </div>
      {members.length === 0 ? (
        <p className="rounded-lg border border-dashed border-mr-line px-4 py-6 text-center text-sm text-mr-muted">No Visa Team members yet.</p>
      ) : (
        <ul className="divide-y divide-mr-line rounded-lg border border-mr-line bg-white">
          {members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-mr-ink">
                  {m.code} · {m.name}
                  <Chip tone="neutral">{labelFor(VISA_TEAM_ROLES, m.role)}</Chip>
                  {!m.active && <Chip tone="muted">Inactive</Chip>}
                </p>
                <p className="text-xs text-mr-muted">
                  {m.phone ?? "No phone"}
                  {m.guide_id ? ` · linked guide ${guides.find((g) => g.id === m.guide_id)?.name ?? ""}` : ""}
                  {m.last_seen_at ? ` · last sign-in ${formatDateTime(m.last_seen_at)}` : " · never signed in"}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="xs"
                disabled={pending}
                onClick={() => {
                  if (!confirm(`Issue a new key for ${m.name}? The current key stops working.`)) return;
                  startTransition(async () => {
                    const res = await rotateVisaMemberKey(m.id);
                    if (!res.ok) return void toast.error(res.error);
                    setIssued({ name: m.name, key: res.data.access_key });
                  });
                }}
              >
                <RefreshCw /> New key
              </Button>
              <label className="flex items-center gap-2 text-xs text-mr-body">
                <Switch
                  checked={m.active}
                  disabled={pending}
                  onCheckedChange={(v) =>
                    startTransition(async () => {
                      const res = await setVisaMemberActive(m.id, v);
                      if (!res.ok) return void toast.error(res.error);
                      router.refresh();
                    })
                  }
                />
                Active
              </label>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!draft} onOpenChange={(o) => !o && !pending && setDraft(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Visa Team member</DialogTitle>
            <DialogDescription>An access key is generated and shown once.</DialogDescription>
          </DialogHeader>
          {draft && (
            <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="vm_code">Code</Label>
                <Input id="vm_code" value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })} placeholder="VT01" autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vm_name">Name</Label>
                <Input id="vm_name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vm_role">Role</Label>
                <Select value={draft.role} onValueChange={(v) => setDraft({ ...draft, role: v })}>
                  <SelectTrigger id="vm_role" className="w-full rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VISA_TEAM_ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vm_phone">Phone</Label>
                <Input id="vm_phone" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} placeholder="+86…" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="vm_guide">Linked guide (optional, for ground staff)</Label>
                <Select value={draft.guide_id ?? "none"} onValueChange={(v) => setDraft({ ...draft, guide_id: v === "none" ? null : v })}>
                  <SelectTrigger id="vm_guide" className="w-full rounded-lg">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {guides.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name}
                        {g.phone ? ` · ${g.phone}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </fieldset>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={pending || !draft?.code.trim() || !draft?.name.trim()}
              onClick={() =>
                draft &&
                startTransition(async () => {
                  const res = await createVisaMember({ code: draft.code, name: draft.name, role: draft.role, phone: draft.phone, guide_id: draft.guide_id });
                  if (!res.ok) return void toast.error(res.error);
                  setIssued({ name: draft.name, key: res.data.access_key });
                  setDraft(null);
                  router.refresh();
                })
              }
            >
              {pending ? <Loader2 className="animate-spin" /> : <KeyRound />} Create and show key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!issued} onOpenChange={(o) => !o && setIssued(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Access key for {issued?.name}</DialogTitle>
            <DialogDescription>Shown once. Only its hash is stored.</DialogDescription>
          </DialogHeader>
          <p className="select-all break-all rounded-md border border-mr-line bg-mr-surface px-3 py-2 font-mono text-sm">{issued?.key}</p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => issued && copy(`${url}\nAccess key: ${issued.key}`)}>
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
