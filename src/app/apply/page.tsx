import { PortalShell } from "@/components/portal/shell";
import { ApplyStart } from "@/components/apply/apply-start";
import { COMPANY } from "@/lib/constants";

export const dynamic = "force-dynamic";

/** Public link: individual travellers apply (and add co-passengers); travel agents bulk upload a group. No partner code is asked. */
export default async function ApplyPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const sp = await searchParams;
  return (
    <PortalShell title="China visa documents" subtitle={`${COMPANY.name} · travellers and travel agents`} homeHref="/apply">
      <p className="mb-1 text-sm text-mr-body">Tell us who is uploading and when the trip is. Then upload the passports: we read the details, you only check them.</p>
      <p className="mb-5 text-xs text-mr-muted">You get a private link to come back and add passengers or documents later. Keep it safe.</p>
      <ApplyStart initialKind={sp.kind === "b2b" ? "b2b" : "b2c"} />
    </PortalShell>
  );
}
