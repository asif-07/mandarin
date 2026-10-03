import Link from "next/link";
import { PortalShell } from "@/components/portal/shell";
import { PortalLogin } from "@/components/portal/portal-login";
import { VisaShell } from "@/components/visa-team/shell";
import { WorkflowStatusChip } from "@/components/workflow/status-chip";
import { NotificationsList } from "@/components/workflow/notifications-list";
import { VisaMarkRead } from "@/components/visa-team/mark-read";
import { Chip } from "@/components/shared/chip";
import { getVisaMember } from "@/lib/portal/auth";
import { listNotifications, listVisaTeamGroups, unreadCount, type WorkflowGroup } from "@/lib/workflow/data";
import { GROUND_BRAND } from "@/lib/constants";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const QUEUES: { title: string; hint: string; statuses: string[] }[] = [
  { title: "Ready for processing", hint: "approved by the company; download the application and start", statuses: ["company_approved"] },
  { title: "Visa processing", hint: "upload the issued visa when ready", statuses: ["visa_processing"] },
  { title: "Visa uploaded, awaiting company approval", hint: "", statuses: ["visa_issued"] },
  { title: "Ground operations", hint: "assign guide, stamped visa, entry and exit", statuses: ["visa_approved", "guide_assigned", "travelling_to_china", "entry_evidence_uploaded", "travelling_in_china"] },
  { title: "Exited / completed", hint: "", statuses: ["china_exited", "completed"] },
];

export default async function VisaTeamHome() {
  const member = await getVisaMember();
  if (!member) {
    return (
      <PortalShell title="China Visa Team" subtitle={`${GROUND_BRAND.name} · visa processing & ground operations`} homeHref="/visa-team">
        <PortalLogin url="/api/visa-team/login" title="Visa Team sign-in" description="Enter your Visa Team access key." />
      </PortalShell>
    );
  }
  const [groups, notifications, unread] = await Promise.all([listVisaTeamGroups(), listNotifications({ audience: "visa_team" }, 20), unreadCount({ audience: "visa_team" })]);

  const Row = ({ g }: { g: WorkflowGroup }) => (
    <li className="px-4 py-2.5">
      <Link href={`/visa-team/groups/${g.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 hover:underline">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs font-medium text-mr-ink">{g.group_ref}</p>
          <p className="text-xs text-mr-muted">
            {formatDate(g.travel_date)} to {formatDate(g.travel_end_date)} · {g.pax_expected ?? g.traveller_count} pax{g.partner_code ? ` · ${g.partner_code}` : " · own client"}
            {g.guide_name ? ` · guide ${g.guide_name}` : ""}
          </p>
        </div>
        {g.other_border_requested && <Chip tone="warning">Other border</Chip>}
        <WorkflowStatusChip status={g.workflow_status} variant="visa" />
      </Link>
    </li>
  );

  return (
    <VisaShell member={member} unread={unread}>
      <div className="grid gap-6 lg:grid-cols-2">
        {QUEUES.map((q) => {
          const list = groups.filter((g) => q.statuses.includes(g.workflow_status ?? ""));
          return (
            <section key={q.title}>
              <h2 className="mb-1 font-heading text-base font-semibold">
                {q.title} <span className="text-sm font-normal text-mr-muted">({list.length})</span>
              </h2>
              {q.hint && <p className="mb-2 text-xs text-mr-muted">{q.hint}</p>}
              {list.length === 0 ? <p className="rounded-lg border border-dashed border-mr-line bg-white px-4 py-4 text-center text-xs text-mr-muted">Nothing here.</p> : <ul className="divide-y divide-mr-line rounded-lg border border-mr-line bg-white">{list.map((g) => <Row key={g.id} g={g} />)}</ul>}
            </section>
          );
        })}
      </div>
      <section id="notifications" className="mt-8">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold">Notifications</h2>
          {unread > 0 && <VisaMarkRead />}
        </div>
        <NotificationsList items={notifications} hrefFor={(n) => (n.group_id ? `/visa-team/groups/${n.group_id}` : null)} />
      </section>
    </VisaShell>
  );
}
