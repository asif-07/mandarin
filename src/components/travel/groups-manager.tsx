"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Layers, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/shared/date-picker";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { bulkCreateGroups, createGroup, deleteGroup, updateGroup } from "@/lib/actions/travel-groups";
import { groupPackReference } from "@/lib/queries/travel";
import { formatDateRange, todayISO } from "@/lib/format";

export type GroupRow = {
  id: string;
  travel_date: string;
  travel_end_date: string;
  group_code: string;
  label: string | null;
  guide_name: string | null;
  notes: string | null;
  reference_prefix: string;
  traveller_count: number;
  created_by_name: string | null;
  created_at: string | null;
};

type Editing = {
  id?: string;
  travel_date: string;
  travel_end_date: string;
  group_code: string;
  reference_prefix: string;
  label: string;
  guide_name: string;
  notes: string;
};

type Bulk = { travel_date: string; travel_end_date: string; count: string; reference_prefix: string; label: string; guide_name: string };

const VALID_CODE = /^G\d{2}$/;

export function GroupsToolbar() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [single, setSingle] = useState<Editing | null>(null);
  const [bulk, setBulk] = useState<Bulk | null>(null);

  function saveSingle() {
    if (!single) return;
    startTransition(async () => {
      const result = single.id ? await updateGroup(single.id, single) : await createGroup(single);
      if (!result.ok) return void toast.error(result.error);
      toast.success(single.id ? "Group updated" : `${single.group_code.toUpperCase()} created`);
      setSingle(null);
      router.refresh();
    });
  }

  function saveBulk() {
    if (!bulk) return;
    startTransition(async () => {
      const result = await bulkCreateGroups({ ...bulk, count: Number(bulk.count) });
      if (!result.ok) return void toast.error(result.error);
      toast.success(
        `Created ${result.data.created} group${result.data.created === 1 ? "" : "s"}${result.data.skipped ? `, ${result.data.skipped} already existed` : ""}`,
      );
      setBulk(null);
      router.refresh();
    });
  }

  const today = todayISO();

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setBulk({ travel_date: today, travel_end_date: today, count: "10", reference_prefix: "MR144", label: "", guide_name: "" })}
      >
        <Layers /> Bulk create
      </Button>
      <Button
        onClick={() =>
          setSingle({ travel_date: today, travel_end_date: today, group_code: "G01", reference_prefix: "MR144", label: "", guide_name: "", notes: "" })
        }
      >
        <Plus /> New group
      </Button>

      <GroupDialog value={single} pending={pending} onChange={setSingle} onSave={saveSingle} />

      <Dialog open={!!bulk} onOpenChange={(o) => !o && setBulk(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk create groups</DialogTitle>
            <DialogDescription>Creates G01 through Gn for one travel window. Existing codes are skipped.</DialogDescription>
          </DialogHeader>
          {bulk && (
            <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Travel start</Label>
                <DatePicker
                  value={bulk.travel_date}
                  onChange={(v) => setBulk({ ...bulk, travel_date: v ?? "", travel_end_date: v && bulk.travel_end_date < v ? v : bulk.travel_end_date })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Travel end</Label>
                <DatePicker value={bulk.travel_end_date} onChange={(v) => setBulk({ ...bulk, travel_end_date: v ?? "" })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bulk_count">Number of groups</Label>
                <Input id="bulk_count" type="number" min={1} max={30} value={bulk.count} onChange={(e) => setBulk({ ...bulk, count: e.target.value })} className="tnum" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bulk_prefix">Reference prefix</Label>
                <Input id="bulk_prefix" value={bulk.reference_prefix} onChange={(e) => setBulk({ ...bulk, reference_prefix: e.target.value.toUpperCase() })} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="bulk_label">Label (optional, applied to all)</Label>
                <Input id="bulk_label" placeholder="Canton Phase 2" value={bulk.label} onChange={(e) => setBulk({ ...bulk, label: e.target.value })} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="bulk_guide">Guide (optional)</Label>
                <Input id="bulk_guide" value={bulk.guide_name} onChange={(e) => setBulk({ ...bulk, guide_name: e.target.value })} />
              </div>
            </fieldset>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulk(null)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={saveBulk} disabled={pending || !bulk?.travel_date || !bulk?.travel_end_date || !Number(bulk?.count)}>
              {pending && <Loader2 className="animate-spin" />} Create {Number(bulk?.count) || ""} groups
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function GroupDialog({
  value,
  pending,
  onChange,
  onSave,
}: {
  value: Editing | null;
  pending: boolean;
  onChange: (v: Editing | null) => void;
  onSave: () => void;
}) {
  const preview =
    value && value.travel_date && value.travel_end_date && VALID_CODE.test(value.group_code)
      ? groupPackReference(
          { travel_date: value.travel_date, travel_end_date: value.travel_end_date, group_code: value.group_code, reference_prefix: value.reference_prefix },
          5,
        )
      : null;

  return (
    <Dialog open={!!value} onOpenChange={(o) => !o && onChange(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{value?.id ? "Edit group" : "New group"}</DialogTitle>
          <DialogDescription>Group codes are unique per travel start date.</DialogDescription>
        </DialogHeader>
        {value && (
          <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Travel start</Label>
              <DatePicker
                value={value.travel_date}
                onChange={(v) => onChange({ ...value, travel_date: v ?? "", travel_end_date: v && value.travel_end_date < v ? v : value.travel_end_date })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Travel end</Label>
              <DatePicker value={value.travel_end_date} onChange={(v) => onChange({ ...value, travel_end_date: v ?? "" })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="g_code">Group code</Label>
              <Input id="g_code" placeholder="G01" value={value.group_code} onChange={(e) => onChange({ ...value, group_code: e.target.value.toUpperCase() })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="g_prefix">Reference prefix</Label>
              <Input id="g_prefix" placeholder="MR144" value={value.reference_prefix} onChange={(e) => onChange({ ...value, reference_prefix: e.target.value.toUpperCase() })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="g_label">Label</Label>
              <Input id="g_label" placeholder="Canton Phase 2 - Morning" value={value.label} onChange={(e) => onChange({ ...value, label: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="g_guide">Guide name</Label>
              <Input id="g_guide" value={value.guide_name} onChange={(e) => onChange({ ...value, guide_name: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="g_notes">Notes</Label>
              <Input id="g_notes" value={value.notes} onChange={(e) => onChange({ ...value, notes: e.target.value })} />
            </div>
            {preview && (
              <p className="text-xs text-mr-muted sm:col-span-2">
                Group PDF will be named like <span className="font-mono text-mr-body">{preview}.pdf</span> (pax count filled in at export).
              </p>
            )}
          </fieldset>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onChange(null)} disabled={pending}>
            Cancel
          </Button>
          <Button
            onClick={onSave}
            disabled={pending || !value?.travel_date || !value?.travel_end_date || !VALID_CODE.test(value?.group_code ?? "")}
          >
            {pending && <Loader2 className="animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function GroupRowActions({ group }: { group: GroupRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function save() {
    if (!editing?.id) return;
    startTransition(async () => {
      const result = await updateGroup(editing.id!, editing);
      if (!result.ok) return void toast.error(result.error);
      toast.success("Group updated");
      setEditing(null);
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteGroup(group.id, group.traveller_count > 0);
      setConfirmDelete(false);
      if (!result.ok) return void toast.error(result.error);
      toast.success(
        `${group.group_code} (${formatDateRange(group.travel_date, group.travel_end_date)}) deleted${
          result.data.unassigned ? `; ${result.data.unassigned} traveller${result.data.unassigned === 1 ? "" : "s"} kept without a group` : ""
        }`,
      );
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Edit group"
        onClick={() =>
          setEditing({
            id: group.id,
            travel_date: group.travel_date,
            travel_end_date: group.travel_end_date,
            group_code: group.group_code,
            reference_prefix: group.reference_prefix,
            label: group.label ?? "",
            guide_name: group.guide_name ?? "",
            notes: group.notes ?? "",
          })
        }
      >
        <Pencil />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label="Delete group" onClick={() => setConfirmDelete(true)}>
        <Trash2 />
      </Button>
      <GroupDialog value={editing} pending={pending} onChange={setEditing} onSave={save} />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${group.group_code} (${formatDateRange(group.travel_date, group.travel_end_date)})?`}
        description={
          group.traveller_count > 0
            ? `${group.traveller_count} traveller${group.traveller_count === 1 ? " is" : "s are"} in this group. They will be kept, with their documents, but left without a group.`
            : "The group is empty and will be removed."
        }
        confirmLabel={group.traveller_count > 0 ? "Remove travellers and delete" : "Delete"}
        destructive
        pending={pending}
        onConfirm={remove}
      />
    </div>
  );
}

export function GroupsList({ groups }: { groups: GroupRow[] }) {
  const byRange = new Map<string, GroupRow[]>();
  groups.forEach((g) => {
    const key = formatDateRange(g.travel_date, g.travel_end_date);
    byRange.set(key, [...(byRange.get(key) ?? []), g]);
  });

  return (
    <div className="space-y-6">
      {[...byRange.entries()].map(([range, list]) => (
        <section key={range}>
          <h2 className="micro-label mb-2">
            {range} <span className="ml-1 normal-case tracking-normal">({list.length} group{list.length === 1 ? "" : "s"})</span>
          </h2>
          <ul className="divide-y divide-mr-line rounded-lg border border-mr-line">
            {list.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5">
                <Link href={`/travel?date=${g.travel_date}`} className="w-12 font-semibold text-mr-ink hover:underline">
                  {g.group_code}
                </Link>
                <span className="min-w-0 flex-1 truncate text-sm text-mr-body">
                  {g.label ?? <span className="text-mr-muted">No label</span>}
                  {g.guide_name ? ` · Guide: ${g.guide_name}` : ""}
                  <span className="ml-2 font-mono text-[11px] text-mr-muted">{groupPackReference(g, g.traveller_count)}</span>
                </span>
                <span className="tnum text-sm text-mr-body">
                  {g.traveller_count} traveller{g.traveller_count === 1 ? "" : "s"}
                </span>
                <GroupRowActions group={g} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
