import Link from "next/link";
import { Plus } from "lucide-react";
import { PortalShell } from "@/components/portal/shell";
import { PortalLogin } from "@/components/portal/portal-login";
import { WorkflowStatusChip } from "@/components/workflow/status-chip";
import { NotificationsList } from "@/components/workflow/notifications-list";
import { PartnerMarkRead } from "@/components/partner/mark-read";
import { buttonVariants } from "@/components/ui/button";
import { getPortalPartner } from "@/lib/portal/auth";
import { listNotifications, listPartnerGroups, unreadCount } from "@/lib/workflow/data";
import { GROUND_BRAND } from "@/lib/constants";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PartnerHome() {
  const partner = await getPortalPartner();
  if (!partner) {
    return (
      <PortalShell title={GROUND_BRAND.name} subtitle="B2B partner portal" homeHref="/partner">
        <PortalLogin url="/api/partner/login" title="Partner sign-in" description="Enter the portal access key issued to your agency. You stay signed in on this device." />
      </PortalShell>
    );
  }
  const target = { audience: "partner" as const, partner_code: partner.code };
  const [groups, notifications, unread] = await Promise.all([listPartnerGroups(partner.code), listNotifications(target, 20), unreadCount(target)]);
  const open = groups.filter((g) => !["completed", "rejected"].includes(g.workflow_status ?? "") && g.travel_end_date >= new Date().toISOString().slice(0, 10));
  const past = groups.filter((g) => !open.includes(g));

  const GroupRow = ({ g }: { g: (typeof groups)[number] }) => (
    <li className="px-4 py-2.5">
      <Link href={`/partner/groups/${g.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 hover:underline">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs font-medium text-mr-ink">{g.group_ref}</p>
          <p className="text-xs text-mr-muted">
            {formatDate(g.travel_date)} to {formatDate(g.travel_end_date)} · {g.pax_expected ?? g.traveller_count} pax{g.label ? ` · ${g.label}` : ""}
          </p>
        </div>
        <WorkflowStatusChip status={g.workflow_status} variant="b2b" />
      </Link>
    </li>
  );

  return (
    <PortalShell title={partner.name} subtitle={`${GROUND_BRAND.name} · B2B partner portal`} homeHref="/partner" user={partner.code} signOutUrl="/api/partner/logout" nav={[{ href: "/partner", label: "Groups" }, { href: "/partner/groups/new", label: "New group" }, { href: "/partner#notifications", label: "Notifications", badge: unread }]}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="font-heading text-xl font-semibold">Your groups</h1>
        <Link href="/partner/groups/new" className={buttonVariants({ size: "sm" })}>
          <Plus /> New group
        </Link>
      </div>
      {groups.length === 0 ? (
        <p className="rounded-lg border border-dashed border-mr-line bg-white px-4 py-8 text-center text-sm text-mr-muted">No groups yet. Create your first group: dates, ports, flight details and the traveller document PDF.</p>
      ) : (
        <>
          <ul className="divide-y divide-mr-line rounded-lg border border-mr-line bg-white">{open.map((g) => <GroupRow key={g.id} g={g} />)}</ul>
          {past.length > 0 && (
            <>
              <p className="micro-label mb-2 mt-6">Past and closed</p>
              <ul className="divide-y divide-mr-line rounded-lg border border-mr-line bg-white">{past.map((g) => <GroupRow key={g.id} g={g} />)}</ul>
            </>
          )}
        </>
      )}
      <section id="notifications" className="mt-8">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold">Notifications</h2>
          {unread > 0 && <PartnerMarkRead />}
        </div>
        <NotificationsList items={notifications} hrefFor={(n) => (n.group_id ? `/partner/groups/${n.group_id}` : null)} />
      </section>
    </PortalShell>
  );
}
