import {
  CANTON_PHASES,
  COUNTRIES,
  CURRENCIES,
  ENQUIRY_TYPES,
  LEAD_SOURCES,
  LEAD_STATUSES,
  PACKAGE_TIERS,
  type Option,
} from "@/lib/constants";
import type { PackageTier } from "@/lib/constants";
import type { LeadInput } from "@/lib/validation/lead";

/**
 * Lead CSV import / export. Shared by the browser (parse + preview) and the
 * server (validate + insert), so it must stay free of server-only imports.
 */

export const LEAD_CSV_COLUMNS = [
  { key: "full_name", label: "Full name", required: true, example: "Ahmed Al Mansoori" },
  { key: "phone", label: "Phone", required: true, example: "+971501234567", hint: "With country code" },
  { key: "email", label: "Email", required: false, example: "ahmed@example.com" },
  { key: "country", label: "Country", required: false, example: "UAE", hint: COUNTRIES.map((c) => c.value).join(" / ") },
  { key: "city", label: "City", required: false, example: "Dubai" },
  { key: "entry_city", label: "Entry city", required: false, example: "Guangzhou" },
  { key: "enquiry_type", label: "Enquiry type", required: true, example: "144hr Visa", hint: ENQUIRY_TYPES.map((t) => t.short).join(" / ") },
  { key: "package_tier", label: "Package tier", required: false, example: "", hint: "Visa Only / Visa + Transit / Visa + Transit + Hotel (package enquiries only)" },
  { key: "source", label: "Source", required: false, example: "WhatsApp", hint: LEAD_SOURCES.map((s) => s.label).join(" / ") },
  { key: "status", label: "Status", required: false, example: "New", hint: LEAD_STATUSES.map((s) => s.label).join(" / ") },
  { key: "pax_count", label: "Pax", required: false, example: "2" },
  { key: "travel_month", label: "Travel month", required: false, example: "Oct 2026" },
  { key: "canton_phase", label: "Canton phase", required: false, example: "", hint: "Phase 1 / Phase 2 / Phase 3" },
  { key: "quoted_amount", label: "Quoted amount", required: false, example: "220" },
  { key: "quoted_currency", label: "Quoted currency", required: false, example: "USD", hint: "USD / AED / CNY / INR" },
  { key: "assigned_to", label: "Assigned to", required: false, example: "sales", hint: "Username or display name of a team member" },
  { key: "next_followup_date", label: "Next follow-up", required: false, example: "2026-09-15", hint: "yyyy-mm-dd" },
  { key: "notes", label: "Notes", required: false, example: "Asked about Canton Fair phase 2" },
] as const;
export type LeadCsvKey = (typeof LEAD_CSV_COLUMNS)[number]["key"];

export const MAX_IMPORT_ROWS = 500;

// ---------------------------------------------------------------------------
// CSV text <-> rows
// ---------------------------------------------------------------------------

/** RFC 4180-ish parser: quoted fields, doubled quotes, CRLF, and a BOM. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows
    .map((r) =>
      r
        .map((v) => {
          const s = v === null || v === undefined ? "" : String(v);
          return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(","),
    )
    .join("\r\n");
}

/** Template with a header row and one example row. */
export function leadTemplateCsv(): string {
  return toCsv([LEAD_CSV_COLUMNS.map((c) => c.label), LEAD_CSV_COLUMNS.map((c) => c.example)]);
}

// ---------------------------------------------------------------------------
// header mapping and value normalisation
// ---------------------------------------------------------------------------

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const HEADER_ALIASES: Record<string, LeadCsvKey> = {
  name: "full_name",
  "full name": "full_name",
  "customer name": "full_name",
  phone: "phone",
  mobile: "phone",
  whatsapp: "phone",
  "phone number": "phone",
  email: "email",
  "e mail": "email",
  country: "country",
  city: "city",
  "entry city": "entry_city",
  "enquiry type": "enquiry_type",
  enquiry: "enquiry_type",
  type: "enquiry_type",
  service: "enquiry_type",
  "package tier": "package_tier",
  tier: "package_tier",
  package: "package_tier",
  source: "source",
  "lead source": "source",
  status: "status",
  pax: "pax_count",
  "pax count": "pax_count",
  travellers: "pax_count",
  "travel month": "travel_month",
  month: "travel_month",
  "canton phase": "canton_phase",
  phase: "canton_phase",
  "quoted amount": "quoted_amount",
  amount: "quoted_amount",
  quote: "quoted_amount",
  "quoted currency": "quoted_currency",
  currency: "quoted_currency",
  "assigned to": "assigned_to",
  assignee: "assigned_to",
  owner: "assigned_to",
  "next follow up": "next_followup_date",
  "next followup": "next_followup_date",
  "follow up": "next_followup_date",
  "follow up date": "next_followup_date",
  notes: "notes",
  note: "notes",
  remarks: "notes",
};

/** Map a header row to column keys; unknown headers become null and are ignored. */
export function mapHeaders(header: string[]): (LeadCsvKey | null)[] {
  return header.map((h) => {
    const n = norm(h);
    if (HEADER_ALIASES[n]) return HEADER_ALIASES[n];
    const direct = LEAD_CSV_COLUMNS.find((c) => c.key === n.replace(/ /g, "_") || norm(c.label) === n);
    return direct?.key ?? null;
  });
}

/** Accept a value, its label or its short label, case-insensitively. */
function matchOption<T extends string>(options: readonly (Option<T> & { short?: string })[], raw: string): T | null {
  const n = norm(raw);
  if (!n) return null;
  const hit = options.find((o) => norm(o.value) === n || norm(o.label) === n || (o.short && norm(o.short) === n));
  return hit?.value ?? null;
}

const ENQUIRY_ALIASES: Record<string, string> = {
  "144": "144hr_visa",
  "144 hr": "144hr_visa",
  "144 hour": "144hr_visa",
  "144hr visa": "144hr_visa",
  "144 hour visa": "144hr_visa",
  "visa free": "144hr_visa",
  "transit visa": "144hr_visa",
  canton: "canton_fair_package",
  "canton fair": "canton_fair_package",
  "canton fair package": "canton_fair_package",
  "business visa": "china_business_visa",
  "m visa": "china_business_visa",
  "china business visa": "china_business_visa",
  group: "group_tour",
  "group tour": "group_tour",
  tour: "group_tour",
  package: "package",
  "hotel package": "package",
  "visa only": "package",
  "visa transit": "package",
  "visa transit hotel": "package",
  "visa and transit": "package",
  "visa transit and hotel": "package",
};

/** "visa + transit + hotel", "visa transit", "visa only" in any spacing/punctuation. */
function matchPackage(raw: string): PackageTier | null {
  const n = norm(raw);
  if (!n) return null;
  if (/hotel/.test(n)) return "visa_transit_hotel";
  if (/transit/.test(n)) return "visa_transit";
  if (/visa/.test(n)) return "visa_only";
  return null;
}

export type NormalisedRow = { input: LeadInput; warnings: string[] };

/**
 * Turn one CSV row into a LeadInput the normal lead schema can validate.
 * Unrecognised enum text is kept as-is so validation reports it clearly.
 */
export function normaliseRow(cells: string[], keys: (LeadCsvKey | null)[], profiles: { id: string; username: string; display_name: string }[]): NormalisedRow {
  const get = (k: LeadCsvKey) => {
    const i = keys.indexOf(k);
    return i === -1 ? "" : (cells[i] ?? "").trim();
  };
  const warnings: string[] = [];

  const enquiryRaw = get("enquiry_type");
  const enquiry = matchOption(ENQUIRY_TYPES, enquiryRaw) ?? ENQUIRY_ALIASES[norm(enquiryRaw)] ?? (enquiryRaw || "");
  let tier = matchOption(PACKAGE_TIERS, get("package_tier"));
  if (!tier && /transit|visa only/i.test(enquiryRaw)) tier = matchPackage(enquiryRaw);
  if (!tier && get("package_tier")) tier = matchPackage(get("package_tier"));

  const countryRaw = get("country");
  const country = countryRaw ? (matchOption(COUNTRIES as unknown as readonly Option[], countryRaw) ?? (/uae|emirates|dubai|abu dhabi/i.test(countryRaw) ? "UAE" : "Other")) : null;
  if (countryRaw && country === "Other" && !/other/i.test(countryRaw)) warnings.push(`Country "${countryRaw}" stored as Other`);

  const assignedRaw = get("assigned_to");
  let assigned: string | null = null;
  if (assignedRaw) {
    const p = profiles.find((x) => norm(x.username) === norm(assignedRaw) || norm(x.display_name) === norm(assignedRaw));
    if (p) assigned = p.id;
    else warnings.push(`Assignee "${assignedRaw}" not found, left unassigned`);
  }

  const phone = get("phone").replace(/[\s\-().]/g, "");
  const phoneNormalised = phone && !phone.startsWith("+") && /^\d{7,15}$/.test(phone) ? (phone.startsWith("00") ? `+${phone.slice(2)}` : `+${phone}`) : phone;
  if (phoneNormalised !== get("phone")) warnings.push(`Phone normalised to ${phoneNormalised}`);

  const followRaw = get("next_followup_date");
  const follow = followRaw ? normaliseDate(followRaw) : null;
  if (followRaw && !follow) warnings.push(`Follow-up date "${followRaw}" not understood`);

  return {
    input: {
      full_name: get("full_name"),
      phone: phoneNormalised,
      email: get("email") || null,
      country,
      city: get("city") || null,
      entry_city: get("entry_city") || null,
      enquiry_type: enquiry,
      package_tier: tier,
      source: matchOption(LEAD_SOURCES, get("source")) ?? (get("source") ? get("source") : "other"),
      status: matchOption(LEAD_STATUSES, get("status")) ?? (get("status") ? get("status") : "new"),
      pax_count: get("pax_count") ? Number(get("pax_count")) : 1,
      travel_month: get("travel_month") || null,
      canton_phase: matchOption(CANTON_PHASES, get("canton_phase")),
      quoted_amount: get("quoted_amount") ? Number(get("quoted_amount").replace(/[^0-9.]/g, "")) : null,
      quoted_currency: matchOption(CURRENCIES, get("quoted_currency")) ?? "USD",
      assigned_to: assigned,
      next_followup_date: follow,
      notes: get("notes") || null,
    },
    warnings,
  };
}

/** "2026-09-15", "15/09/2026", "15-09-2026", "15 Sep 2026" -> yyyy-mm-dd */
function normaliseDate(raw: string): string | null {
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dmy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  const t = Date.parse(s);
  if (!Number.isNaN(t)) {
    const d = new Date(t);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  }
  return null;
}
