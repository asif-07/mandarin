import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalShell } from "@/components/portal/shell";
import { PartnerBulkUpload } from "@/components/partner/bulk-upload";
import { getPortalPartner } from "@/lib/portal/auth";
import { GROUND_BRAND } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function PartnerBulkUploadPage() {
  const partner = await getPortalPartner();
  if (!partner) redirect("/partner");
  return (
    <PortalShell title={partner.name} subtitle={`${GROUND_BRAND.name} · B2B partner portal`} homeHref="/partner" user={partner.code} signOutUrl="/api/partner/logout" nav={[{ href: "/partner", label: "Groups" }, { href: "/partner/groups/upload", label: "Bulk upload" }, { href: "/partner/groups/new", label: "New group" }]}>
      <h1 className="font-heading text-xl font-semibold">Bulk upload</h1>
      <p className="mb-4 mt-1 text-sm text-mr-body">
        Upload the same group PDF you send today. The code in the file name is recognised and the group is created with its dates and pax; the PDF is filed as the traveller documents. Prefer to type the details?{" "}
        <Link href="/partner/groups/new" className="underline">
          Create a group by form
        </Link>
        .
      </p>
      <PartnerBulkUpload partnerCode={partner.code} />
    </PortalShell>
  );
}
