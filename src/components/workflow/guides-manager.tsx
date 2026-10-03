"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Chip } from "@/components/shared/chip";
import type { GuideInput, GuideRow } from "@/lib/workflow/guides";

type SaveFn = (id: string | null, input: GuideInput) => Promise<{ ok: true; data: { id: string } } | { ok: false; error: string }>;
type Draft = { id: string | null; name: string; phone: string; role: string; languages: string; notes: string; active: boolean };

/** Guide / staff master list with add and edit, used by the company settings and the Visa Team extension. */
export function GuidesManager({ guides, save }: { guides: GuideRow[]; save: SaveFn }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<Draft | null>(null);

  function submit() {
    if (!draft) return;
    startTransition(async () => {
      const res = await save(draft.id, { name: draft.name, phone: draft.phone, role: draft.role, languages: draft.languages, notes: draft.notes, active: draft.active });
      if (!res.ok) return void toast.error(res.error);
      toast.success(draft.id ? "Guide updated" : "Guide added");
      setDraft(null);
      router.refresh();
    });
  }

  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button type="button" onClick={() => setDraft({ id: null, name: "", phone: "", role: "Guide", languages: "", notes: "", active: true })}>
          <Plus /> Add guide
        </Button>
      </div>
      {guides.length === 0 ? (
        <p className="rounded-lg border border-dashed border-mr-line px-4 py-6 text-center text-sm text-mr-muted">No guides yet.</p>
      ) : (
        <ul className="divide-y divide-mr-line rounded-lg border border-mr-line bg-white">
          {guides.map((g) => (
            <li key={g.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-mr-ink">
                  {g.name}
                  <Chip tone="neutral">{g.role}</Chip>
                  {!g.active && <Chip tone="muted">Inactive</Chip>}
                </p>
                <p className="text-xs text-mr-muted">
                  {g.phone ?? "No phone"}
                  {g.languages ? ` · ${g.languages}` : ""}
                  {g.notes ? ` · ${g.notes}` : ""}
                </p>
              </div>
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`Edit ${g.name}`} onClick={() => setDraft({ id: g.id, name: g.name, phone: g.phone ?? "", role: g.role, languages: g.languages ?? "", notes: g.notes ?? "", active: g.active })}>
                <Pencil />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={!!draft} onOpenChange={(o) => !o && !pending && setDraft(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit guide" : "New guide"}</DialogTitle>
          </DialogHeader>
          {draft && (
            <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="gd_name">Guide name</Label>
                <Input id="gd_name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gd_phone">Contact number</Label>
                <Input id="gd_phone" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} placeholder="+86…" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gd_role">Role</Label>
                <Input id="gd_role" value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })} placeholder="Guide / Driver / Coordinator" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="gd_lang">Languages (optional)</Label>
                <Input id="gd_lang" value={draft.languages} onChange={(e) => setDraft({ ...draft, languages: e.target.value })} placeholder="English, Mandarin, Cantonese" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="gd_notes">Operational notes (optional)</Label>
                <Input id="gd_notes" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
              </div>
              <div className="flex items-center gap-2 sm:col-span-2">
                <Switch id="gd_active" checked={draft.active} onCheckedChange={(v) => setDraft({ ...draft, active: v })} />
                <Label htmlFor="gd_active">Active</Label>
              </div>
            </fieldset>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button type="button" disabled={pending || !draft?.name.trim()} onClick={submit}>
              {pending && <Loader2 className="animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
