import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { LeadForm } from "@/components/leads/lead-form";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";

export const metadata: Metadata = { title: "New lead" };

export default async function NewLeadPage() {
  const supabase = await createClient();
  const [{ data: profiles }, current] = await Promise.all([
    supabase.from("profiles").select("id, display_name").order("display_name"),
    getCurrentProfile(),
  ]);

  return (
    <>
      <PageHeader title="New lead" description="Name, phone and enquiry type are enough. Everything else can wait." />
      <div className="max-w-3xl">
        <LeadForm mode="create" profiles={profiles ?? []} currentUserId={current?.profile?.id} />
      </div>
    </>
  );
}
