import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { ServicesManager } from "@/components/settings/services-manager";
import { listServices } from "@/lib/actions/services";

export const metadata: Metadata = { title: "Product / Service master" };

export default async function ServicesSettingsPage() {
  const services = await listServices(false);
  return (
    <>
      <PageHeader
        title="Product / Service master"
        description="The single list of services a group can carry. Details entered on the group flow to the invoice and the transfer voucher."
        actions={
          <Link href="/settings" className="text-sm text-mr-body hover:text-mr-ink hover:underline">
            Back to settings
          </Link>
        }
      />
      <ServicesManager services={services} />
    </>
  );
}
