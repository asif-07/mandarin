import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { FollowupGroup } from "@/components/leads/followup-list";
import { createClient } from "@/lib/supabase/server";
import { getFollowups } from "@/lib/queries/followups";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Follow-ups" };

export default async function FollowupsPage() {
  const supabase = await createClient();
  const { today, overdue, dueToday, thisWeek } = await getFollowups(supabase, 7);

  return (
    <>
      <PageHeader title="Follow-ups" description={`Leads to chase as of ${formatDate(today)}. Snooze pushes the date forward from today.`} />
      <div className="max-w-3xl space-y-8">
        <FollowupGroup title="Overdue" leads={overdue} tone="red" />
        <FollowupGroup title="Today" leads={dueToday} tone="warning" />
        <FollowupGroup title="This week" leads={thisWeek} />
      </div>
    </>
  );
}
