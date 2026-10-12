import { PortalShell } from "@/components/portal/shell";
import { ArrivalForm } from "@/components/arrivals/arrival-form";
import { createAdminClient } from "@/lib/supabase/admin";
import { GROUND_BRAND } from "@/lib/constants";

export const dynamic = "force-dynamic";

/** Public link for travel agents: HONG KONG GROUP ARRIVAL DETAILS for the airport transfer. */
export default async function ArrivalsPage({ searchParams }: { searchParams: Promise<{ partner?: string }> }) {
  const sp = await searchParams;
  const supabase = createAdminClient();
  const { data } = await supabase.from("b2b_partners").select("code, name").order("code");
  return (
    <PortalShell title="Hong Kong group arrival details" subtitle={`${GROUND_BRAND.name} · airport transfer`} homeHref="/arrivals">
      <p className="mb-4 text-sm text-mr-body">Please share the following details for the airport transfer. We will reply with the arrangement.</p>
      <ArrivalForm partners={data ?? []} presetPartner={sp.partner?.toUpperCase() ?? null} />
    </PortalShell>
  );
}
