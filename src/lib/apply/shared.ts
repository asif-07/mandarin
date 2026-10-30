/** Shared by the public portal, its API and the CRM (no server-only imports). */
import { DOC_TYPES } from "@/lib/constants";

export type ApplicationKind = "b2c" | "b2b";

export type ApplicantDoc = {
  id: string;
  doc_type: string;
  file_name: string;
  file_size: number | null;
  mime_type: string;
  uploaded_at: string | null;
  preview_url: string | null;
};

/** One passenger on an application (an ordinary traveller row). */
export type PassengerView = {
  id: string;
  traveller_ref: string;
  full_name: string;
  given_name: string | null;
  surname: string | null;
  phone: string | null;
  email: string | null;
  nationality: string | null;
  passport_number: string | null;
  date_of_birth: string | null;
  sex: string | null;
  passport_expiry: string | null;
  address: string | null;
  pan_number: string | null;
  travel_start_date: string;
  travel_end_date: string;
  status: string;
  group_ref: string | null;
  grouped: boolean;
  /** "has_par" (uploads it) or "needs_par" (we apply); null until answered. */
  par_answer: string | null;
  /** Personal link for this passenger to fill in their own details (co-passenger invite). */
  invite_token: string | null;
  documents: ApplicantDoc[];
};

/** An application: the private link, the contact, the dates and its passengers. */
export type ApplicationView = {
  id: string;
  token: string;
  /** True once submitted: names are locked, documents can still be added or replaced (time-stamped). */
  locked?: boolean;
  kind: ApplicationKind;
  contact_name: string;
  contact_phone: string | null;
  contact_email: string | null;
  agency_name: string | null;
  nationality: string | null;
  travel_start_date: string;
  travel_end_date: string;
  /** How many travel together (asked on the first page; minimum 2 for the group transit visa). */
  pax: number | null;
  status: string;
  submitted_at: string | null;
  ready: boolean;
  group_ref: string | null;
  passengers: PassengerView[];
};

/** 144-hour transit: at most 5 nights / 6 days; exit on the 6th day before 18:00. */
export const PORTAL_TITLE = "144 hours China transit visa application";
export const MAX_STAY_NIGHTS = 5;
export const EXIT_BY_TIME = "6 pm";
export const MIN_PAX = 2;
export function maxExitDate(entry: string): string {
  const d = new Date(`${entry}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + MAX_STAY_NIGHTS);
  return d.toISOString().slice(0, 10);
}
/** Null when the dates respect the 144-hour rule, else the problem. */
export function checkTransitDates(entry: string, exit: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry) || !/^\d{4}-\d{2}-\d{2}$/.test(exit)) return "Choose both dates";
  if (exit < entry) return "The exit date must be on or after the entry date";
  if (exit > maxExitDate(entry)) return `Maximum stay is ${MAX_STAY_NIGHTS} nights / ${MAX_STAY_NIGHTS + 1} days: with entry on ${entry} you must exit by ${maxExitDate(entry)} (${EXIT_BY_TIME})`;
  return null;
}

/** What the portal asks for per passenger, in order. `need` = must be there before submitting. */
export const PORTAL_DOCS = [
  { type: "passport", need: true, title: "Passport front (data page)", hint: "The page with the photo. The details are read from it automatically." },
  { type: "passport_back", need: true, title: "Passport back (address page)", hint: "The last page with the address and family details." },
  { type: "photo", need: true, title: "Passport-size photo", hint: "Recent colour photo, plain light background, face straight to the camera." },
  { type: "pan_card", need: true, title: "PAN card", hint: "Front side, all details readable. The PAN number is read from it." },
  { type: "par", need: false, title: "Hong Kong PAR", hint: "Pre-Arrival Registration for Hong Kong. If you do not have it, we apply for it." },
  { type: "hotel_booking", need: false, title: "Hotel booking", hint: "Confirmation with the traveller's name and the dates, if booked already." },
  { type: "flight_ticket", need: false, title: "Flight ticket", hint: "E-ticket or itinerary, if booked." },
] as const;
export type PortalDocType = (typeof PORTAL_DOCS)[number]["type"];

export function portalDocLabel(type: string): string {
  return PORTAL_DOCS.find((d) => d.type === type)?.title ?? DOC_TYPES.find((d) => d.value === type)?.label ?? type;
}

/** Profile fields a passenger needs before the application can go. Agents are not asked for the home address. */
export function requiredFields(kind: ApplicationKind): ("given_name" | "surname" | "passport_number" | "address" | "pan_number")[] {
  return kind === "b2b" ? ["given_name", "surname", "passport_number", "pan_number"] : ["given_name", "surname", "passport_number", "address", "pan_number"];
}
export const FIELD_LABELS: Record<string, string> = { full_name: "name", given_name: "given name", surname: "surname", passport_number: "passport number", address: "address", pan_number: "PAN number", par_answer: "PAR question (have it or not)" };

export type Completeness = {
  missingDocs: string[];
  missingFields: string[];
  /** PAR and hotel booking both uploaded: this passenger can go straight to the visa. */
  ready: boolean;
  complete: boolean;
};

export function passengerCompleteness(p: Pick<PassengerView, "given_name" | "surname" | "passport_number" | "address" | "pan_number" | "documents" | "par_answer">, kind: ApplicationKind): Completeness {
  const present = new Set(p.documents.map((d) => d.doc_type));
  const missingDocs = PORTAL_DOCS.filter((d) => d.need && !present.has(d.type)).map((d) => d.type);
  // The PAR question must be answered: either the PAR is uploaded, or we were asked to apply for it.
  if (p.par_answer === "has_par" && !present.has("par")) missingDocs.push("par");
  const missingFields: string[] = requiredFields(kind).filter((f) => !(p[f] ?? "").toString().trim());
  if (!p.par_answer && !present.has("par")) missingFields.push("par_answer");
  return { missingDocs, missingFields, ready: present.has("par") && present.has("hotel_booking"), complete: missingDocs.length === 0 && missingFields.length === 0 };
}

export type ApplicationCompleteness = {
  canSubmit: boolean;
  ready: boolean;
  passengers: { id: string; full_name: string; completeness: Completeness }[];
};

export function applicationCompleteness(a: Pick<ApplicationView, "kind" | "passengers">): ApplicationCompleteness {
  const passengers = a.passengers.map((p) => ({ id: p.id, full_name: p.full_name, completeness: passengerCompleteness(p, a.kind) }));
  // (kind stays "b2c" for the public page; the agent flow was dropped)
  return {
    canSubmit: passengers.length > 0 && passengers.every((p) => p.completeness.complete),
    ready: passengers.length > 0 && passengers.every((p) => p.completeness.ready),
    passengers,
  };
}

/** Human description of what is still missing on one passenger. */
export function missingSummary(c: Completeness): string {
  return [...c.missingDocs.map(portalDocLabel), ...c.missingFields.map((f) => FIELD_LABELS[f] ?? f)].join(", ");
}
