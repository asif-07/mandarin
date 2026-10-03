import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { GuidesManager } from "@/components/workflow/guides-manager";
import { listGuidesForCompany, saveGuideForCompany } from "@/lib/actions/workflow";

export const metadata: Metadata = { title: "Guide / staff master" };

export default async function GuidesSettingsPage() {
  const guides = await listGuidesForCompany();
  return (
    <>
      <PageHeader
        title="Guide / staff master"
        description="The guides the China Visa Team assigns to groups for ground operations. Name, contact number, role and optional language / operational notes."
        actions={
          <Link href="/settings" className="text-sm text-mr-body hover:text-mr-ink hover:underline">
            Back to settings
          </Link>
        }
      />
      <GuidesManager guides={guides} save={saveGuideForCompany} />
    </>
  );
}
