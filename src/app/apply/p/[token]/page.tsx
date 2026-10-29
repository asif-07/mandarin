import { notFound } from "next/navigation";
import { PortalShell } from "@/components/portal/shell";
import { ApplicationPage } from "@/components/apply/application-page";
import { loadApplicationByToken } from "@/lib/apply/server";
import { PORTAL_TITLE } from "@/lib/apply/shared";
import { COMPANY } from "@/lib/constants";

export const dynamic = "force-dynamic";

/** A co-passenger's personal page: only their own passport, details and documents, through their invite link. */
export default async function CoPassengerPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const app = await loadApplicationByToken(token);
  if (!app || app.passengers.length !== 1) notFound();
  return (
    <PortalShell title={PORTAL_TITLE} subtitle={`${COMPANY.name} · travelling with ${app.contact_name}`} homeHref={`/apply/p/${token}`}>
      <ApplicationPage initial={{ ...app, token }} mode="passenger" />
    </PortalShell>
  );
}
