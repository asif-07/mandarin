import { notFound } from "next/navigation";
import { PortalShell } from "@/components/portal/shell";
import { ApplicationPage } from "@/components/apply/application-page";
import { loadApplicationByToken } from "@/lib/apply/server";
import { PORTAL_TITLE } from "@/lib/apply/shared";
import { COMPANY } from "@/lib/constants";

export const dynamic = "force-dynamic";

/** The applicant's own page, reachable only through the random token in the link. */
export default async function ApplicantPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const app = await loadApplicationByToken(token);
  if (!app) notFound();
  return (
    <PortalShell title={PORTAL_TITLE} subtitle={COMPANY.name} homeHref={`/apply/t/${token}`}>
      <ApplicationPage initial={app} mode="applicant" />
    </PortalShell>
  );
}
