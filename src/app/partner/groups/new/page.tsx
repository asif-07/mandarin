import { redirect } from "next/navigation";
import { PortalShell } from "@/components/portal/shell";
import { PartnerGroupForm } from "@/components/partner/group-form";
import { getPortalPartner } from "@/lib/portal/auth";
import { GROUND_BRAND } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function NewPartnerGroupPage() {
  const partner = await getPortalPartner();
  if (!partner) redirect("/partner");
  return (
    <PortalShell title={partner.name} subtitle={`${GROUND_BRAND.name} · B2B partner portal`} homeHref="/partner" user={partner.code} signOutUrl="/api/partner/logout" nav={[{ href: "/partner", label: "Groups" }, { href: "/partner/groups/new", label: "New group" }]}>
      <h1 className="mb-4 font-heading text-xl font-semibold">New group</h1>
      <PartnerGroupForm />
    </PortalShell>
  );
}
