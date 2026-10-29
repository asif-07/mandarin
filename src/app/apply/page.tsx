import { PortalShell } from "@/components/portal/shell";
import { ApplyStart } from "@/components/apply/apply-start";
import { PORTAL_TITLE } from "@/lib/apply/shared";
import { COMPANY } from "@/lib/constants";

export const dynamic = "force-dynamic";

/** Public link for travellers: start a 144-hour China transit visa application (co-passengers are added on the next page). */
export default function ApplyPage() {
  return (
    <PortalShell title={PORTAL_TITLE} subtitle={COMPANY.name} homeHref="/apply">
      <p className="mb-1 text-sm text-mr-body">Tell us when you expect to travel, then upload your passport. We read the details for you; you only check them.</p>
      <p className="mb-5 text-xs text-mr-muted">You get a private link to come back and add co-passengers or documents later. Keep it safe.</p>
      <ApplyStart />
    </PortalShell>
  );
}
