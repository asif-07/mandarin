import { PortalShell } from "@/components/portal/shell";
import { GROUND_BRAND, VISA_TEAM_ROLES, labelFor } from "@/lib/constants";
import type { VisaMember } from "@/lib/portal/auth";

export function VisaShell({ member, unread, children }: { member: VisaMember; unread?: number; children: React.ReactNode }) {
  return (
    <PortalShell
      title="China Visa Team"
      subtitle={`${GROUND_BRAND.name} · visa processing & ground operations`}
      homeHref="/visa-team"
      user={`${member.name} · ${labelFor(VISA_TEAM_ROLES, member.role)}`}
      signOutUrl="/api/visa-team/logout"
      wide
      nav={[
        { href: "/visa-team", label: "Groups" },
        { href: "/visa-team#notifications", label: "Notifications", badge: unread },
        { href: "/visa-team/guides", label: "Guide master" },
      ]}
    >
      {children}
    </PortalShell>
  );
}
