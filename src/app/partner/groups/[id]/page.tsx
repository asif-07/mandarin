import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PortalShell } from "@/components/portal/shell";
import { WorkflowStatusChip } from "@/components/workflow/status-chip";
import { WorkflowTimeline } from "@/components/workflow/timeline";
import { GroupFacts } from "@/components/workflow/group-facts";
import { PartnerGroupForm } from "@/components/partner/group-form";
import { PartnerGroupActions } from "@/components/partner/group-actions";
import { buttonVariants } from "@/components/ui/button";
import { getPortalPartner } from "@/lib/portal/auth";
import { listEvents, loadWorkflowGroup } from "@/lib/workflow/data";
import { GROUND_BRAND, WORKFLOW_ORDER, workflowMeta } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

const after = (status: string | null, step: string) => (status ? WORKFLOW_ORDER.indexOf(status as never) >= WORKFLOW_ORDER.indexOf(step as never) : false);

export default async function PartnerGroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const partner = await getPortalPartner();
  if (!partner) redirect(`/partner`);
  const g = await loadWorkflowGroup(id);
  if (!g || g.partner_code !== partner.code) notFound();
  const events = await listEvents(id);
  const editable = ["draft", "correction_requested"].includes(g.workflow_status ?? "");
  const visaAvailable = !!g.visa_path && (after(g.workflow_status, "visa_approved") || g.workflow_status === null);
  const stampedAvailable = !!g.stamped_visa_path && g.stamped_visa_shared;
  const meta = workflowMeta(g.workflow_status);

  return (
    <PortalShell title={partner.name} subtitle={`${GROUND_BRAND.name} · B2B partner portal`} homeHref="/partner" user={partner.code} signOutUrl="/api/partner/logout" nav={[{ href: "/partner", label: "Groups" }, { href: "/partner/groups/upload", label: "Bulk upload" }, { href: "/partner/groups/new", label: "New group" }]}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="font-heading text-xl font-semibold">{g.group_ref}</h1>
          <p className="text-sm text-mr-body">
            {formatDate(g.travel_date)} to {formatDate(g.travel_end_date)} · {g.pax_expected ?? g.traveller_count} pax{g.label ? ` · ${g.label}` : ""}
          </p>
        </div>
        <WorkflowStatusChip status={g.workflow_status} variant="b2b" className="h-7 text-sm" />
      </div>

      {g.workflow_status === "correction_requested" && g.company_decision_note && <p className="mb-4 rounded-md border border-mr-red/40 bg-mr-red/5 p-3 text-sm text-mr-red">Correction requested: {g.company_decision_note}</p>}
      {g.workflow_status === "rejected" && <p className="mb-4 rounded-md border border-mr-red/40 bg-mr-red/5 p-3 text-sm text-mr-red">Rejected{g.company_decision_note ? `: ${g.company_decision_note}` : ""}. Create a new group if the trip still goes ahead.</p>}
      {g.workflow_status === "draft" && <p className="mb-4 rounded-md border border-mr-line bg-white p-3 text-sm text-mr-body">Draft. Upload the traveller documents, then submit the group for company approval.</p>}
      {meta && !["draft", "correction_requested", "rejected"].includes(g.workflow_status ?? "") && <p className="mb-4 rounded-md border border-mr-line bg-white p-3 text-sm text-mr-body">{meta.b2b.charAt(0) + meta.b2b.slice(1).toLowerCase()}. {g.workflow_status === "visa_approved" ? "Download the approved visa below; it was also sent to your registered email." : g.workflow_status === "travelling_in_china" ? "China entry was confirmed by the guide." : g.workflow_status === "china_exited" ? "The group has exited China." : ""}</p>}

      <section className="mb-6 rounded-lg border border-mr-line bg-white p-4">
        <p className="micro-label mb-2">Documents</p>
        <ul className="space-y-2 text-sm">
          <li className="flex flex-wrap items-center justify-between gap-2">
            <span>
              Traveller documents (bulk PDF)
              <span className="block text-xs text-mr-muted">{g.pack_path ? `${g.pack_file_name} · uploaded ${g.pack_uploaded_at ? formatDateTime(g.pack_uploaded_at) : ""}` : "Not uploaded yet · passports, PAR, hotel bookings, flight tickets in one PDF"}</span>
            </span>
            <span className="flex items-center gap-2">
              {g.pack_path && (
                <a href={`/api/partner/groups/${g.id}/file?kind=pack`} className={buttonVariants({ variant: "outline", size: "xs" })}>
                  Download
                </a>
              )}
              {editable && <PartnerGroupActions groupId={g.id} mode="upload" hasPack={!!g.pack_path} />}
            </span>
          </li>
          <li className="flex flex-wrap items-center justify-between gap-2">
            <span>
              Approved visa
              <span className="block text-xs text-mr-muted">{visaAvailable ? `${g.visa_file_name}${g.visa_approved_at ? ` · approved ${formatDateTime(g.visa_approved_at)}` : ""}${g.visa_emailed_at ? ` · emailed ${formatDateTime(g.visa_emailed_at)}` : ""}` : "Available here once the company approves the issued visa"}</span>
            </span>
            {visaAvailable && (
              <a href={`/api/partner/groups/${g.id}/file?kind=visa`} className={buttonVariants({ size: "xs" })}>
                Download visa
              </a>
            )}
          </li>
          <li className="flex flex-wrap items-center justify-between gap-2">
            <span>
              China entry — stamped visa
              <span className="block text-xs text-mr-muted">{stampedAvailable ? `${g.stamped_visa_file_name} · uploaded ${g.stamped_visa_uploaded_at ? formatDateTime(g.stamped_visa_uploaded_at) : ""}` : g.stamped_visa_path ? "Uploaded at entry; the company can share it with you" : "Uploaded by the guide at the China immigration counter"}</span>
            </span>
            {stampedAvailable && (
              <a href={`/api/partner/groups/${g.id}/file?kind=stamped`} className={buttonVariants({ variant: "outline", size: "xs" })}>
                Download
              </a>
            )}
          </li>
        </ul>
        {editable && (
          <div className="mt-4 border-t border-mr-line pt-3">
            <PartnerGroupActions groupId={g.id} mode="submit" hasPack={!!g.pack_path} />
          </div>
        )}
      </section>

      {editable ? (
        <section className="mb-6">
          <p className="micro-label mb-2">Group details</p>
          <PartnerGroupForm
            groupId={g.id}
            initial={{
              pax_expected: String(g.pax_expected ?? ""),
              travel_date: g.travel_date,
              travel_end_date: g.travel_end_date,
              other_border_requested: g.other_border_requested,
              entry_port: g.entry_port ?? "",
              exit_port: g.exit_port ?? "",
              other_border_note: g.other_border_note ?? "",
              arrival_flight_date: g.arrival_flight_date ?? "",
              arrival_flight_time: g.arrival_flight_time ?? "",
              arrival_flight_no: g.arrival_flight_no ?? "",
              departure_flight_date: g.departure_flight_date ?? "",
              departure_flight_time: g.departure_flight_time ?? "",
              departure_flight_no: g.departure_flight_no ?? "",
              label: g.label ?? "",
              notes: g.notes ?? "",
            }}
          />
        </section>
      ) : (
        <section className="mb-6">
          <GroupFacts g={g} />
        </section>
      )}

      <section>
        <p className="micro-label mb-2">Status timeline</p>
        <WorkflowTimeline events={events} />
      </section>
      <p className="mt-6 text-xs text-mr-muted">
        <Link href="/partner" className="underline">
          Back to your groups
        </Link>
      </p>
    </PortalShell>
  );
}
