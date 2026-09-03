import { addDays, parseISO } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { FollowupLead } from "@/components/leads/followup-list";
import { todayISO, toISODate } from "@/lib/format";

/** Leads with a follow-up due up to `daysAhead` days from today, excluding won/lost. */
export async function getFollowups(supabase: SupabaseClient<Database>, daysAhead = 7) {
  const today = todayISO();
  const until = toISODate(addDays(parseISO(today), daysAhead));
  const { data } = await supabase
    .from("leads")
    .select("id, lead_ref, full_name, phone, enquiry_type, status, next_followup_date, assignee:profiles!leads_assigned_to_fkey(display_name)")
    .not("next_followup_date", "is", null)
    .lte("next_followup_date", until)
    .not("status", "in", "(won,lost)")
    .order("next_followup_date", { ascending: true })
    .limit(300);

  const rows: FollowupLead[] = (data ?? []).map((l) => ({
    id: l.id,
    lead_ref: l.lead_ref,
    full_name: l.full_name,
    phone: l.phone,
    enquiry_type: l.enquiry_type,
    status: l.status,
    next_followup_date: l.next_followup_date,
    assigned_name: l.assignee?.display_name ?? null,
  }));

  return {
    today,
    overdue: rows.filter((r) => r.next_followup_date! < today),
    dueToday: rows.filter((r) => r.next_followup_date === today),
    thisWeek: rows.filter((r) => r.next_followup_date! > today),
  };
}
