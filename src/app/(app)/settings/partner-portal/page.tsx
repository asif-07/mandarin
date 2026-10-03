import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { PartnerPortalManager } from "@/components/settings/partner-portal-manager";
import { listPartnerAccess } from "@/lib/actions/workflow";

export const metadata: Metadata = { title: "B2B partner portal access" };

export default async function PartnerPortalSettingsPage() {
  const partners = await listPartnerAccess();
  return (
    <>
      <PageHeader
        title="B2B partner portal access"
        description="Partners sign in to the portal with an access key, submit groups with flight details and documents, follow the status, and download the approved visa. Add partners (and their registered email) on the B2B groups page first."
        actions={
          <Link href="/settings" className="text-sm text-mr-body hover:text-mr-ink hover:underline">
            Back to settings
          </Link>
        }
      />
      <PartnerPortalManager partners={partners} />
    </>
  );
}
