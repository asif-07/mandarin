import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { buttonVariants } from "@/components/ui/button";
import { LeadImport } from "@/components/leads/lead-import";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Import leads" };

export default async function ImportLeadsPage() {
  const supabase = await createClient();
  const { data: profiles } = await supabase.from("profiles").select("id, username, display_name").order("display_name");
  return (
    <>
      <PageHeader
        title="Import leads"
        description="Upload a CSV to create many leads at once. Rows are checked before anything is saved; each lead gets its own LD- number."
        actions={
          <Link href="/leads" className={buttonVariants({ variant: "outline" })}>
            <ArrowLeft /> Back to leads
          </Link>
        }
      />
      <LeadImport profiles={profiles ?? []} />
    </>
  );
}
