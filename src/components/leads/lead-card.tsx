import Link from "next/link";
import { Users } from "lucide-react";
import { COUNTRIES, ENQUIRY_TYPES, PACKAGE_TIERS, labelFor } from "@/lib/constants";
import { daysFromToday, formatMoney, initials } from "@/lib/format";
import { cn } from "@/lib/utils";

export type KanbanLead = {
  id: string;
  lead_ref: string;
  full_name: string;
  phone: string;
  enquiry_type: string;
  package_tier: string | null;
  country: string | null;
  pax_count: number | null;
  quoted_amount: number | null;
  quoted_currency: string | null;
  status: string;
  next_followup_date: string | null;
  assigned_name: string | null;
  created_at: string | null;
};

/** "144hr Visa", "Package 4★" */
export function enquiryShort(enquiryType: string, packageTier: string | null | undefined) {
  const base = ENQUIRY_TYPES.find((t) => t.value === enquiryType)?.short ?? labelFor(ENQUIRY_TYPES, enquiryType);
  const tier = PACKAGE_TIERS.find((t) => t.value === packageTier)?.short;
  return tier ? `${base} ${tier}` : base;
}

export function followupDue(date: string | null) {
  const d = daysFromToday(date);
  return d !== null && d <= 0;
}

export function LeadCardBody({ lead, className }: { lead: KanbanLead; className?: string }) {
  const country = COUNTRIES.find((c) => c.value === lead.country);
  const due = followupDue(lead.next_followup_date);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-start justify-between gap-2">
        <Link href={`/leads/${lead.id}`} className="min-w-0 truncate text-sm font-medium text-mr-ink hover:underline">
          {lead.full_name}
        </Link>
        {due && (
          <span className="mt-1.5 size-2 shrink-0 rounded-full bg-mr-red" title="Follow-up due" aria-label="Follow-up due" />
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-md bg-mr-surface px-1.5 py-0.5 text-[11px] font-medium text-mr-body">
          {enquiryShort(lead.enquiry_type, lead.package_tier)}
        </span>
        {country && (
          <span className="text-[11px] text-mr-body" title={country.label}>
            {country.flag} {country.code || country.label}
          </span>
        )}
        <span className="inline-flex items-center gap-0.5 text-[11px] text-mr-body">
          <Users className="size-3" /> {lead.pax_count ?? 1}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="tnum text-xs text-mr-body">
          {lead.quoted_amount != null ? formatMoney(lead.quoted_amount, lead.quoted_currency ?? "USD") : ""}
        </span>
        {lead.assigned_name && (
          <span
            className="flex size-6 items-center justify-center rounded-full bg-mr-ink text-[10px] font-semibold text-white"
            title={lead.assigned_name}
          >
            {initials(lead.assigned_name)}
          </span>
        )}
      </div>
    </div>
  );
}
