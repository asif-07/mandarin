"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";
import { LeadCardBody, type KanbanLead } from "@/components/leads/lead-card";
import { LostReasonDialog } from "@/components/leads/lost-reason-dialog";
import { changeLeadStatus } from "@/lib/actions/leads";
import { KANBAN_STATUSES, LEAD_STATUSES, labelFor, type LeadStatus } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function KanbanBoard({ leads: initial }: { leads: KanbanLead[] }) {
  const router = useRouter();
  const [leads, setLeads] = useState(initial);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingLost, setPendingLost] = useState<{ lead: KanbanLead; from: string } | null>(null);
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const byStatus = useMemo(() => {
    const map = new Map<string, KanbanLead[]>();
    KANBAN_STATUSES.forEach((s) => map.set(s, []));
    leads.forEach((l) => map.get(l.status)?.push(l));
    return map;
  }, [leads]);

  const active = activeId ? leads.find((l) => l.id === activeId) : null;

  function applyStatus(id: string, status: string) {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
  }

  function commit(lead: KanbanLead, from: string, to: LeadStatus, lostReason?: string, note?: string) {
    setBusy(true);
    startTransition(async () => {
      const result = await changeLeadStatus(lead.id, { status: to, lost_reason: lostReason ?? null, note: note || null });
      setBusy(false);
      setPendingLost(null);
      if (!result.ok) {
        applyStatus(lead.id, from); // rollback
        toast.error(result.error);
        return;
      }
      toast.success(`${lead.full_name} moved to ${labelFor(LEAD_STATUSES, to)}`);
      router.refresh();
    });
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const lead = leads.find((l) => l.id === active.id);
    const to = String(over.id) as LeadStatus;
    if (!lead || !KANBAN_STATUSES.includes(to) || lead.status === to) return;
    const from = lead.status;
    applyStatus(lead.id, to); // optimistic
    if (to === "lost") {
      setPendingLost({ lead, from });
      return;
    }
    commit(lead, from, to);
  }

  return (
    <>
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-4 md:mx-0 md:px-0">
          {KANBAN_STATUSES.map((status) => (
            <Column key={status} status={status} leads={byStatus.get(status) ?? []} />
          ))}
        </div>
        <DragOverlay>
          {active ? (
            <div className="w-[84vw] max-w-[280px] rounded-lg border border-mr-ink bg-white p-3 sm:w-[260px]">
              <LeadCardBody lead={active} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <LostReasonDialog
        open={!!pendingLost}
        leadName={pendingLost?.lead.full_name}
        pending={busy}
        onCancel={() => {
          if (pendingLost) applyStatus(pendingLost.lead.id, pendingLost.from);
          setPendingLost(null);
        }}
        onConfirm={(reason, note) => pendingLost && commit(pendingLost.lead, pendingLost.from, "lost", reason, note)}
      />
    </>
  );
}

function Column({ status, leads }: { status: LeadStatus; leads: KanbanLead[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-[84vw] max-w-[280px] shrink-0 snap-start flex-col rounded-lg border border-mr-line bg-mr-surface/60 sm:w-[260px]",
        isOver && "border-mr-ink",
      )}
    >
      <div className="flex items-center justify-between px-3 py-2.5">
        <span className={cn("micro-label", status === "won" && "text-mr-success", status === "lost" && "text-mr-red")}>
          {labelFor(LEAD_STATUSES, status)}
        </span>
        <span className="tnum text-xs text-mr-muted">{leads.length}</span>
      </div>
      <div className="flex min-h-[120px] flex-1 flex-col gap-2 px-2 pb-2">
        {leads.map((lead) => (
          <Card key={lead.id} lead={lead} />
        ))}
        {leads.length === 0 && <p className="px-1 py-4 text-center text-xs text-mr-muted">Drop leads here</p>}
      </div>
    </div>
  );
}

function Card({ lead }: { lead: KanbanLead }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        "cursor-grab touch-manipulation rounded-lg border border-mr-line bg-white p-3 outline-none focus-visible:ring-2 focus-visible:ring-mr-ink",
        isDragging && "opacity-40",
      )}
    >
      <LeadCardBody lead={lead} />
    </div>
  );
}
