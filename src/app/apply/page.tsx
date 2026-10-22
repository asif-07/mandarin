import { PortalShell } from "@/components/portal/shell";
import { ApplyStart } from "@/components/apply/apply-start";
import { COMPANY } from "@/lib/constants";

export const dynamic = "force-dynamic";

/** Public link for individual (B2C) customers: start a China visa application. */
export default function ApplyPage() {
  return (
    <PortalShell title="China visa application" subtitle={`${COMPANY.name} · individual travellers`} homeHref="/apply">
      <p className="mb-1 text-sm text-mr-body">Tell us when you travel, then upload your passport. We read the passport details for you; you only check them.</p>
      <p className="mb-5 text-xs text-mr-muted">You will get a private link to come back and add documents later. Keep it safe.</p>
      <ApplyStart />
    </PortalShell>
  );
}
