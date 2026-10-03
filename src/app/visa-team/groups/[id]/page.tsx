import { notFound, redirect } from "next/navigation";
import { VisaShell } from "@/components/visa-team/shell";
import { WorkflowStatusChip } from "@/components/workflow/status-chip";
import { WorkflowTimeline } from "@/components/workflow/timeline";
import { GroupFacts } from "@/components/workflow/group-facts";
import { VisaGroupActions } from "@/components/visa-team/group-actions";
import { getVisaMember } from "@/lib/portal/auth";
import { listEvents, loadWorkflowGroup, unreadCount } from "@/lib/workflow/data";
import { listGuides } from "@/lib/workflow/guides";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function VisaTeamGroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const member = await getVisaMember();
  if (!member) redirect("/visa-team");
  const g = await loadWorkflowGroup(id);
  if (!g || !g.workflow_status) notFound();
  const [events, guides, unread] = await Promise.all([listEvents(id), listGuides(true), unreadCount({ audience: "visa_team" })]);

  return (
    <VisaShell member={member} unread={unread}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="font-heading text-xl font-semibold">{g.group_ref}</h1>
          <p className="text-sm text-mr-body">
            {formatDate(g.travel_date)} to {formatDate(g.travel_end_date)} · {g.pax_expected ?? g.traveller_count} pax{g.partner_code ? ` · ${g.partner_code}${g.partner_name ? ` (${g.partner_name})` : ""}` : " · own client"}
            {g.label ? ` · ${g.label}` : ""}
          </p>
        </div>
        <WorkflowStatusChip status={g.workflow_status} variant="visa" className="h-7 text-sm" />
      </div>

      <VisaGroupActions g={g} guides={guides} member={member} />

      <div className="mt-6">
        <GroupFacts g={g} />
      </div>
      <section className="mt-6">
        <p className="micro-label mb-2">Timeline</p>
        <WorkflowTimeline events={events} />
      </section>
    </VisaShell>
  );
}
