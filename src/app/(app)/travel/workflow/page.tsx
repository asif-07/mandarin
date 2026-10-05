import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";
import { StatCard, StatGrid } from "@/components/shared/stat-card";
import { Chip } from "@/components/shared/chip";
import { WorkflowStatusChip } from "@/components/workflow/status-chip";
import { WorkflowTimeline } from "@/components/workflow/timeline";
import { GroupFacts } from "@/components/workflow/group-facts";
import { GroupWorkflowPanel } from "@/components/travel/group-workflow-panel";
import { requireProfile } from "@/lib/auth";
import { listCompanyWorkflowGroups, listEvents, loadWorkflowGroup } from "@/lib/workflow/data";
import { WORKFLOW_STATUSES, workflowMeta } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/format";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Group workflow" };
export const dynamic = "force-dynamic";

/** The company's board of every group in the B2B / Visa Team workflow, plus one group's full timeline when ?group= is set. */
export default async function WorkflowPage({ searchParams }: { searchParams: Promise<{ group?: string; status?: string }> }) {
  await requireProfile();
  const sp = await searchParams;
  const groups = await listCompanyWorkflowGroups();
  const focus = sp.group ? await loadWorkflowGroup(sp.group) : null;
  const events = focus ? await listEvents(focus.id) : [];
  const counts = new Map<string, number>();
  groups.forEach((g) => counts.set(g.workflow_status ?? "", (counts.get(g.workflow_status ?? "") ?? 0) + 1));
  const needsCompany = groups.filter((g) => ["submitted", "correction_requested", "visa_issued"].includes(g.workflow_status ?? ""));
  const list = sp.status ? groups.filter((g) => g.workflow_status === sp.status) : groups;

  return (
    <>
      <PageHeader title="Group workflow" description="Partner submissions, CTS approval, China Visa Team processing, visa approval and ground operations, on the one group record." />

      {focus && (
        <section className="mb-8 rounded-lg border border-mr-ink bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-heading text-lg font-semibold">
                {focus.group_ref}
                {focus.label ? <span className="font-sans text-sm font-normal text-mr-body"> · {focus.label}</span> : null}
              </p>
              <p className="text-xs text-mr-muted">
                {formatDate(focus.travel_date)} to {formatDate(focus.travel_end_date)} · {focus.pax_expected ?? focus.traveller_count} pax{focus.partner_code ? ` · ${focus.partner_code}${focus.partner_name ? ` (${focus.partner_name})` : ""}` : " · own client"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <WorkflowStatusChip status={focus.workflow_status} />
              <Link href={`/travel?date=${focus.travel_date}`} className={buttonVariants({ variant: "outline", size: "xs" })}>
                Open group card
              </Link>
            </div>
          </div>
          <div className="mt-4">
            <GroupWorkflowPanel g={{ ...focus }} />
          </div>
          <div className="mt-4">
            <GroupFacts g={focus} />
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <p className="micro-label mb-2">Files</p>
              <ul className="space-y-1 text-sm">
                <li>{focus.pack_path ? <a className="underline" href={`/api/groups/${focus.id}/b2b-pack`}>Partner pack · {focus.pack_file_name}</a> : <span className="text-mr-muted">No partner pack</span>}</li>
                <li>{focus.visa_path ? <a className="underline" href={`/api/groups/${focus.id}/visa`}>Visa · {focus.visa_file_name}{focus.visa_uploaded_at ? ` · ${formatDateTime(focus.visa_uploaded_at)}` : ""}</a> : <span className="text-mr-muted">No visa uploaded</span>}</li>
                <li>{focus.stamped_visa_path ? <a className="underline" href={`/api/groups/${focus.id}/stamped-visa`}>China entry — stamped visa · {focus.stamped_visa_file_name}</a> : <span className="text-mr-muted">No stamped visa copy</span>}</li>
              </ul>
            </div>
            <div>
              <p className="micro-label mb-2">Timeline</p>
              <WorkflowTimeline events={events} />
            </div>
          </div>
        </section>
      )}

      {groups.length > 0 && (
        <StatGrid cols={5} className="mb-6">
          <StatCard label="In workflow" value={groups.length} hint="groups with a status" tone="ink" />
          <StatCard label="Needs company action" value={needsCompany.length} hint="submissions and visas to review" tone={needsCompany.length ? "warning" : "success"} href="/travel/workflow?status=submitted" />
          <StatCard label="With Visa Team" value={(counts.get("company_approved") ?? 0) + (counts.get("visa_processing") ?? 0)} hint="ready or processing" tone="neutral" href="/travel/workflow?status=visa_processing" />
          <StatCard label="Travelling in China" value={counts.get("travelling_in_china") ?? 0} hint="entry confirmed" tone="neutral" href="/travel/workflow?status=travelling_in_china" />
          <StatCard label="Exited" value={(counts.get("china_exited") ?? 0) + (counts.get("completed") ?? 0)} hint="exit confirmed or completed" tone="success" href="/travel/workflow?status=china_exited" />
        </StatGrid>
      )}

      <div className="mb-4 flex flex-wrap gap-1 text-xs">
        <Link href="/travel/workflow" className={`rounded-md px-2 py-1 ${!sp.status ? "bg-mr-ink text-white" : "bg-mr-surface text-mr-body hover:text-mr-ink"}`}>
          All {groups.length}
        </Link>
        {WORKFLOW_STATUSES.filter((s) => counts.get(s.value)).map((s) => (
          <Link key={s.value} href={`/travel/workflow?status=${s.value}`} className={`rounded-md px-2 py-1 ${sp.status === s.value ? "bg-mr-ink text-white" : "bg-mr-surface text-mr-body hover:text-mr-ink"}`}>
            {s.label} {counts.get(s.value)}
          </Link>
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title={groups.length === 0 ? "No group is in the workflow yet. Partners submit from their portal; use Send to Visa Team on a group card for groups created here." : "No groups with that status."} />
      ) : (
        <ul className="divide-y divide-mr-line rounded-lg border border-mr-line bg-white">
          {list.map((g) => (
            <li key={g.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <Link href={`/travel/workflow?group=${g.id}`} className="font-mono text-xs font-medium text-mr-ink hover:underline">
                  {g.group_ref}
                </Link>
                <p className="truncate text-xs text-mr-muted">
                  {formatDate(g.travel_date)} to {formatDate(g.travel_end_date)} · {g.pax_expected ?? g.traveller_count} pax{g.partner_code ? ` · ${g.partner_code}` : ""}
                  {g.guide_name ? ` · guide ${g.guide_name}` : ""}
                  {g.workflow_updated_at ? ` · ${formatDateTime(g.workflow_updated_at)}` : ""}
                </p>
              </div>
              {g.other_border_requested && <Chip tone="warning">Other border</Chip>}
              {g.submitted_by_partner && <Chip tone="neutral">Partner submitted</Chip>}
              <WorkflowStatusChip status={g.workflow_status} />
              <span className="text-[11px] text-mr-muted">{workflowMeta(g.workflow_status)?.b2b}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
