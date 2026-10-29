import { notFound } from "next/navigation";
import { PortalShell } from "@/components/portal/shell";
import { ApplicationPage } from "@/components/apply/application-page";
import { loadApplicationByToken } from "@/lib/apply/server";
import { COMPANY } from "@/lib/constants";

export const dynamic = "force-dynamic";

/** The uploader's own application page, reachable only through the random token in the link. */
export default async function ApplicantPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const app = await loadApplicationByToken(token);
  if (!app) notFound();
  return (
    <PortalShell title={app.kind === "b2b" ? "Visa documents · group upload" : "China visa application"} subtitle={`${COMPANY.name} · ${app.kind === "b2b" ? (app.agency_name ?? "travel agent") : "individual travellers"}`} homeHref={`/apply/t/${token}`}>
      <ApplicationPage initial={app} />
    </PortalShell>
  );
}
