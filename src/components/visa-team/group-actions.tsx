"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Download, FileUp, Loader2, LogOut, MapPin, Play, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { assignGuide, confirmChinaEntry, markGroupExited, markTravellingToChina, setGroundOps, startVisaProcessing } from "@/lib/actions/visa-team";
import type { WorkflowGroup } from "@/lib/workflow/data";
import type { GuideRow } from "@/lib/workflow/guides";
import type { VisaMember } from "@/lib/portal/auth";
import { WORKFLOW_ORDER } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";

const stage = (s: string | null) => (s ? WORKFLOW_ORDER.indexOf(s as never) : -1);

/**
 * Everything the Visa Team does on one group: download the application,
 * start processing, upload the issued visa, assign the guide, set the
 * destination and vehicle, upload the stamped entry visa, confirm China
 * entry, and mark the group as exited.
 */
export function VisaGroupActions({ g, guides, member }: { g: WorkflowGroup; guides: GuideRow[]; member: VisaMember }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"visa" | "stamped" | null>(null);
  const [guideId, setGuideId] = useState<string | null>(g.guide_id);
  const [guideNotes, setGuideNotes] = useState(g.guide_notes ?? "");
  const [destination, setDestination] = useState(g.destination ?? "");
  const [vehicle, setVehicle] = useState(g.vehicle_notes ?? "");
  const visaRef = useRef<HTMLInputElement>(null);
  const stampedRef = useRef<HTMLInputElement>(null);
  const s = g.workflow_status;
  const at = stage(s);

  function run(label: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error ?? "Failed", { duration: 8000 });
      toast.success(label);
      router.refresh();
    });
  }

  async function upload(kind: "visa" | "stamped", file: File) {
    setBusy(kind);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch(`/api/visa-team/groups/${g.id}/${kind === "visa" ? "visa" : "stamped-visa"}`, { method: "POST", body: fd });
      const body = (await res.json().catch(() => ({}))) as { error?: string; file_name?: string };
      if (!res.ok) return void toast.error(body.error ?? "Upload failed", { duration: 8000 });
      toast.success(kind === "visa" ? "Visa uploaded · VISA ISSUED — ORIGINAL COPY UPLOADED" : "Stamped visa uploaded · ENTRY EVIDENCE UPLOADED");
      router.refresh();
    } catch {
      toast.error("No connection. The file was not uploaded.");
    } finally {
      setBusy(null);
    }
  }

  const canGround = at >= stage("visa_approved");

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Visa processing */}
      <section className="rounded-lg border border-mr-line bg-white p-4">
        <p className="micro-label mb-2">Visa processing</p>
        <div className="flex flex-wrap items-center gap-2">
          <a href={`/api/visa-team/groups/${g.id}/application`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            <Download /> Download application & documents
          </a>
          {s === "company_approved" && (
            <Button type="button" size="sm" disabled={pending} onClick={() => run("Processing started", () => startVisaProcessing(g.id))}>
              <Play /> Start processing
            </Button>
          )}
        </div>
        <div className="mt-3 border-t border-mr-line pt-3">
          <p className="text-sm font-medium">Issued visa (original copy)</p>
          <p className="text-xs text-mr-muted">
            {g.visa_path ? `${g.visa_file_name} · uploaded ${g.visa_uploaded_at ? formatDateTime(g.visa_uploaded_at) : ""}${g.visa_approved_at ? ` · company approved ${formatDateTime(g.visa_approved_at)}` : " · awaiting company approval"}` : "Upload the visa copy once issued (PDF or photo). It stays attached to the group permanently."}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {g.visa_path && (
              <a href={`/api/visa-team/groups/${g.id}/visa`} className={buttonVariants({ variant: "outline", size: "xs" })}>
                <Download /> Visa copy
              </a>
            )}
            {(s === "visa_processing" || s === "company_approved" || s === "visa_issued") && (
              <>
                <input ref={visaRef} type="file" accept="application/pdf,image/jpeg,image/png,image/heic" className="hidden" onChange={(e) => e.target.files?.[0] && void upload("visa", e.target.files[0])} />
                <Button type="button" size="xs" variant={g.visa_path ? "outline" : "default"} disabled={busy !== null} onClick={() => visaRef.current?.click()}>
                  {busy === "visa" ? <Loader2 className="animate-spin" /> : <FileUp />} {g.visa_path ? "Replace visa copy" : "Upload visa copy"}
                </Button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Ground operations */}
      <section className="rounded-lg border border-mr-line bg-white p-4">
        <p className="micro-label mb-2">Ground operations</p>
        {!canGround && <p className="mb-2 text-xs text-mr-muted">Available once the company approves the visa.</p>}
        <fieldset disabled={!canGround || pending} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="vg_guide">Assigned guide</Label>
            <Select value={guideId ?? "none"} onValueChange={(v) => setGuideId(v === "none" ? null : v)}>
              <SelectTrigger id="vg_guide" className="w-full rounded-lg">
                <SelectValue placeholder="Choose a guide" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No guide</SelectItem>
                {guides.map((x) => (
                  <SelectItem key={x.id} value={x.id}>
                    {x.name}
                    {x.phone ? ` · ${x.phone}` : ""}
                    {x.role ? ` · ${x.role}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="vg_gnotes">Language / operational notes (optional)</Label>
            <Input id="vg_gnotes" value={guideNotes} onChange={(e) => setGuideNotes(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Button type="button" size="sm" variant="outline" onClick={() => run(guideId ? "Guide assigned" : "Guide unassigned", () => assignGuide(g.id, guideId, guideNotes))}>
              <UserCheck /> {g.guide_id ? "Reassign guide" : "Assign guide"}
            </Button>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vg_dest">Destination</Label>
            <Input id="vg_dest" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Guangzhou / Foshan / Zhongshan" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vg_vehicle">Transfer / vehicle details</Label>
            <Input id="vg_vehicle" value={vehicle} onChange={(e) => setVehicle(e.target.value)} placeholder="Coach 粤B·12345, driver Mr Chen" />
          </div>
          <div className="sm:col-span-2">
            <Button type="button" size="sm" variant="outline" onClick={() => run("Ground operations saved", () => setGroundOps(g.id, { destination, vehicle_notes: vehicle }))}>
              <MapPin /> Save destination & vehicle
            </Button>
          </div>
        </fieldset>
      </section>

      {/* Entry / exit */}
      <section className="rounded-lg border border-mr-line bg-white p-4 lg:col-span-2">
        <p className="micro-label mb-2">China entry / exit</p>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <p className="text-sm font-medium">1 · Travelling to China</p>
            <p className="text-xs text-mr-muted">Mark when the group departs for the border.</p>
            {canGround && at < stage("travelling_to_china") && (
              <Button type="button" size="sm" variant="outline" className="mt-2" disabled={pending} onClick={() => run("Marked travelling to China", () => markTravellingToChina(g.id))}>
                Mark travelling to China
              </Button>
            )}
            {at >= stage("travelling_to_china") && <p className="mt-2 text-xs text-mr-success">Done</p>}
          </div>
          <div>
            <p className="text-sm font-medium">2 · Upload stamped visa copy</p>
            <p className="text-xs text-mr-muted">{g.stamped_visa_path ? `CHINA ENTRY — STAMPED VISA · ${g.stamped_visa_file_name} · ${g.stamped_visa_uploaded_at ? formatDateTime(g.stamped_visa_uploaded_at) : ""}` : "Clear photo or scan of the stamped original visa returned by the immigration officer."}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {g.stamped_visa_path && (
                <a href={`/api/visa-team/groups/${g.id}/stamped-visa`} className={buttonVariants({ variant: "outline", size: "xs" })}>
                  <Download /> View
                </a>
              )}
              {canGround && at < stage("china_exited") && (
                <>
                  <input ref={stampedRef} type="file" accept="application/pdf,image/jpeg,image/png,image/heic" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && void upload("stamped", e.target.files[0])} />
                  <Button type="button" size="xs" variant={g.stamped_visa_path ? "outline" : "default"} disabled={busy !== null} onClick={() => stampedRef.current?.click()}>
                    {busy === "stamped" ? <Loader2 className="animate-spin" /> : <FileUp />} {g.stamped_visa_path ? "Replace" : "Upload stamped visa copy"}
                  </Button>
                </>
              )}
            </div>
            {g.stamped_visa_path && at < stage("travelling_in_china") && <p className="mt-1 text-xs font-medium text-mr-ink">ENTRY EVIDENCE UPLOADED</p>}
          </div>
          <div>
            <p className="text-sm font-medium">3 · Confirm entry, then exit</p>
            <p className="text-xs text-mr-muted">{g.china_entry_at ? `Entered China ${formatDateTime(g.china_entry_at)} · ${g.china_entry_confirmed_by ?? ""}` : "Only after the guide confirms does the status become TRAVELLING IN CHINA."}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {at < stage("travelling_in_china") && canGround && (
                <Button type="button" size="sm" disabled={pending || !g.stamped_visa_path} onClick={() => run("China entry confirmed · TRAVELLING IN CHINA", () => confirmChinaEntry(g.id))}>
                  <CheckCircle2 /> Confirm China entry
                </Button>
              )}
              {s === "travelling_in_china" && (
                <Button type="button" size="sm" variant="destructive" disabled={pending} onClick={() => confirm(`Mark ${g.group_ref} as exited from China?`) && run("Group marked as exited · CHINA EXITED", () => markGroupExited(g.id))}>
                  <LogOut /> Mark group as exited
                </Button>
              )}
              {g.china_exit_at && <p className="text-xs text-mr-success">Exited {formatDateTime(g.china_exit_at)} · {g.china_exit_confirmed_by}</p>}
            </div>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-mr-muted">Signed in as {member.name}. Every action is recorded on the group timeline.</p>
      </section>
    </div>
  );
}
