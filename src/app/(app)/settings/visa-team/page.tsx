import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { VisaTeamManager } from "@/components/settings/visa-team-manager";
import { listGuidesForCompany, listVisaMembers } from "@/lib/actions/workflow";

export const metadata: Metadata = { title: "China Visa Team" };

export default async function VisaTeamSettingsPage() {
  const [members, guides] = await Promise.all([listVisaMembers(), listGuidesForCompany()]);
  return (
    <>
      <PageHeader
        title="China Visa Team access"
        description="Visa processing staff, the team leader and ground / guide staff sign in to the Visa Team extension with an access key. Ground staff can be linked to a guide from the master."
        actions={
          <Link href="/settings" className="text-sm text-mr-body hover:text-mr-ink hover:underline">
            Back to settings
          </Link>
        }
      />
      <VisaTeamManager members={members} guides={guides} />
    </>
  );
}
