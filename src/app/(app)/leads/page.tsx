import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CalendarClock, Plus, Users } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { KanbanBoard } from "@/components/leads/kanban-board";
import { LeadsTable } from "@/components/leads/leads-table";
import { LeadFilters } from "@/components/leads/lead-filters";
import type { KanbanLead } from "@/components/leads/lead-card";
import { Pagination, pageRange, parsePage } from "@/components/shared/pagination";
import { createClient } from "@/lib/supabase/server";
import { KANBAN_STATUSES } from "@/lib/constants";

export const metadata: Metadata = { title: "Leads" };

type Search = { q?: string; status?: string; type?: string; country?: string; source?: string; owner?: string; view?: string; page?: string };

const LEAD_COLUMNS =
  "id, lead_ref, full_name, phone, enquiry_type, country, pax_count, quoted_amount, quoted_currency, status, next_followup_date, created_at, assignee:profiles!leads_assigned_to_fkey(display_name)";

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const isTable = sp.view === "table";
  const page = parsePage(sp.page);
  const supabase = await createClient();

  const { data: profiles } = await supabase.from("profiles").select("id, display_name").order("display_name");

  let query = supabase.from("leads").select(LEAD_COLUMNS, { count: "exact" });
  if (sp.status) query = query.eq("status", sp.status);
  else if (!isTable) query = query.in("status", KANBAN_STATUSES);
  if (sp.type) query = query.eq("enquiry_type", sp.type);
  if (sp.country) query = query.eq("country", sp.country);
  if (sp.source) query = query.eq("source", sp.source);
  if (sp.owner) query = query.eq("assigned_to", sp.owner);
  if (sp.q) {
    const like = `%${sp.q.replace(/[%,]/g, "")}%`;
    query = query.or(`full_name.ilike.${like},phone.ilike.${like},lead_ref.ilike.${like}`);
  }
  query = query.order("created_at", { ascending: false });
  if (isTable) {
    const [from, to] = pageRange(page);
    query = query.range(from, to);
  } else {
    query = query.limit(400); // board shows everything active; older lost/won leads live in the table view
  }

  const { data, count, error } = await query;
  const rows: KanbanLead[] = (data ?? []).map((l) => ({
    id: l.id,
    lead_ref: l.lead_ref,
    full_name: l.full_name,
    phone: l.phone,
    enquiry_type: l.enquiry_type,
    country: l.country,
    pax_count: l.pax_count,
    quoted_amount: l.quoted_amount == null ? null : Number(l.quoted_amount),
    quoted_currency: l.quoted_currency,
    status: l.status,
    next_followup_date: l.next_followup_date,
    assigned_name: l.assignee?.display_name ?? null,
    created_at: l.created_at,
  }));
  const hasFilters = !!(sp.q || sp.status || sp.type || sp.country || sp.source || sp.owner);

  return (
    <>
      <PageHeader
        title="Leads"
        actions={
          <>
            <Link href="/leads/followups" className={buttonVariants({ variant: "outline" })}>
              <CalendarClock /> Follow-ups
            </Link>
            <Link href="/leads/new" className={buttonVariants()}>
              <Plus /> New lead
            </Link>
          </>
        }
      />
      <LeadFilters profiles={(profiles ?? []).map((p) => ({ value: p.id, label: p.display_name }))} />

      {error ? (
        <p className="text-sm text-mr-red">Could not load leads: {error.message}</p>
      ) : rows.length === 0 && (isTable || hasFilters) ? (
        <EmptyState
          icon={Users}
          title={hasFilters ? "No leads match these filters." : "No leads yet. Add the first one."}
          action={
            !hasFilters && (
              <Link href="/leads/new" className={buttonVariants()}>
                <Plus /> New lead
              </Link>
            )
          }
        />
      ) : isTable ? (
        <>
          <LeadsTable rows={rows} />
          <Suspense>
            <Pagination page={page} total={count ?? 0} />
          </Suspense>
        </>
      ) : (
        <KanbanBoard key={JSON.stringify(sp)} leads={rows} />
      )}
    </>
  );
}
