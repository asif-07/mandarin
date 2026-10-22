import { notFound } from "next/navigation";
import { PortalShell } from "@/components/portal/shell";
import { ApplyProfile } from "@/components/apply/apply-profile";
import { loadApplicantByToken } from "@/lib/apply/server";
import { COMPANY } from "@/lib/constants";

export const dynamic = "force-dynamic";

/** The customer's own application page, reachable only through the random token in the link. */
export default async function ApplicantPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const applicant = await loadApplicantByToken(token);
  if (!applicant) notFound();
  return (
    <PortalShell title="China visa application" subtitle={`${COMPANY.name} · ${applicant.traveller_ref}`} homeHref={`/apply/t/${token}`}>
      <ApplyProfile initial={applicant} />
    </PortalShell>
  );
}
