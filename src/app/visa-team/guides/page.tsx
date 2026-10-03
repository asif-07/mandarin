import { redirect } from "next/navigation";
import { VisaShell } from "@/components/visa-team/shell";
import { GuidesManager } from "@/components/workflow/guides-manager";
import { getVisaMember } from "@/lib/portal/auth";
import { listGuides } from "@/lib/workflow/guides";
import { unreadCount } from "@/lib/workflow/data";
import { saveGuideForVisaTeam } from "@/lib/actions/visa-team";

export const dynamic = "force-dynamic";

export default async function VisaTeamGuidesPage() {
  const member = await getVisaMember();
  if (!member) redirect("/visa-team");
  const [guides, unread] = await Promise.all([listGuides(false), unreadCount({ audience: "visa_team" })]);
  return (
    <VisaShell member={member} unread={unread}>
      <h1 className="mb-1 font-heading text-xl font-semibold">Guide / staff master</h1>
      <p className="mb-4 text-sm text-mr-body">Guides assigned to groups for ground operations: name, contact number, role, languages and notes.</p>
      <GuidesManager guides={guides} save={saveGuideForVisaTeam} />
    </VisaShell>
  );
}
