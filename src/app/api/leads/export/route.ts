import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { CANTON_PHASES, ENQUIRY_TYPES, LEAD_SOURCES, LEAD_STATUSES, LOST_REASONS, PACKAGE_TIERS, labelFor } from "@/lib/constants";
import { toCsv } from "@/lib/leads/csv";
import { todayISO } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * CSV export of leads. Accepts the same filters as the leads list
 * (q, status, type, country, source, owner) so "export what I see" works.
 */
export async function GET(request: NextRequest) {
  const current = await getCurrentProfile();
  if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const supabase = await createClient();
  let query = supabase
    .from("leads")
    .select(
      "lead_ref, full_name, phone, email, country, city, entry_city, enquiry_type, package_tier, source, status, lost_reason, pax_count, travel_month, canton_phase, quoted_amount, quoted_currency, next_followup_date, notes, created_at, updated_at, assignee:profiles!leads_assigned_to_fkey(display_name), creator:profiles!leads_created_by_fkey(display_name)",
    )
    .order("created_at", { ascending: false })
    .limit(10000);
  if (sp.get("status")) query = query.eq("status", sp.get("status")!);
  if (sp.get("type")) query = query.eq("enquiry_type", sp.get("type")!);
  if (sp.get("country")) query = query.eq("country", sp.get("country")!);
  if (sp.get("source")) query = query.eq("source", sp.get("source")!);
  if (sp.get("owner")) query = query.eq("assigned_to", sp.get("owner")!);
  if (sp.get("q")) {
    const like = `%${sp.get("q")!.replace(/[%,]/g, "")}%`;
    query = query.or(`full_name.ilike.${like},phone.ilike.${like},lead_ref.ilike.${like}`);
  }
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = [
    [
      "Lead",
      "Full name",
      "Phone",
      "Email",
      "Country",
      "City",
      "Entry city",
      "Enquiry type",
      "Package tier",
      "Source",
      "Status",
      "Lost reason",
      "Pax",
      "Travel month",
      "Canton phase",
      "Quoted amount",
      "Quoted currency",
      "Assigned to",
      "Next follow-up",
      "Notes",
      "Created by",
      "Created at",
      "Updated at",
    ],
    ...(data ?? []).map((l) => [
      l.lead_ref,
      l.full_name,
      l.phone,
      l.email,
      l.country,
      l.city,
      l.entry_city,
      labelFor(ENQUIRY_TYPES, l.enquiry_type),
      l.package_tier ? labelFor(PACKAGE_TIERS, l.package_tier) : "",
      labelFor(LEAD_SOURCES, l.source),
      labelFor(LEAD_STATUSES, l.status),
      l.lost_reason ? labelFor(LOST_REASONS, l.lost_reason) : "",
      l.pax_count,
      l.travel_month,
      l.canton_phase ? labelFor(CANTON_PHASES, l.canton_phase) : "",
      l.quoted_amount,
      l.quoted_currency,
      l.assignee?.display_name ?? "",
      l.next_followup_date,
      l.notes,
      l.creator?.display_name ?? "",
      l.created_at,
      l.updated_at,
    ]),
  ];

  return new NextResponse("﻿" + toCsv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="leads-${todayISO()}.csv"`,
      "cache-control": "no-store",
    },
  });
}
