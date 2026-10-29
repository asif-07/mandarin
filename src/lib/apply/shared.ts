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
  documents: ApplicantDoc[];
};

/** An application: the private link, the contact, the dates and its passengers. */
export type ApplicationView = {
  id: string;
  token: string;
  kind: ApplicationKind;
  contact_name: string;
  contact_phone: string | null;
  contact_email: string | null;
  agency_name: string | null;
  nationality: string | null;
  travel_start_date: string;
  travel_end_date: string;
  status: string;
  submitted_at: string | null;
  ready: boolean;
  group_ref: string | null;
  passengers: PassengerView[];
};

/** What the portal asks for per passenger, in order. `need` = must be there before submitting. */
export const PORTAL_DOCS = [
  { type: "passport", need: true, title: "Passport", hint: "Photo of the data page (the page with the photo). The details are read from it automatically." },
  { type: "photo", need: true, title: "Passport-size photo", hint: "Recent colour photo, plain light background, face straight to the camera." },
  { type: "pan_card", need: true, title: "PAN card", hint: "Front side, all details readable. The PAN number is read from it." },
  { type: "par", need: false, title: "PAR", hint: "If the PAR is already there, upload it and we apply directly. Otherwise we prepare it from the passport." },
  { type: "hotel_booking", need: false, title: "Hotel booking", hint: "Confirmation with the traveller's name and the dates, if booked already." },
  { type: "flight_ticket", need: false, title: "Flight ticket", hint: "E-ticket or itinerary, if booked." },
] as const;
export type PortalDocType = (typeof PORTAL_DOCS)[number]["type"];

export function portalDocLabel(type: string): string {
  return PORTAL_DOCS.find((d) => d.type === type)?.title ?? DOC_TYPES.find((d) => d.value === type)?.label ?? type;
}

/** Profile fields a passenger needs before the application can go. Agents are not asked for the home address. */
export function requiredFields(kind: ApplicationKind): ("full_name" | "passport_number" | "address" | "pan_number")[] {
  return kind === "b2b" ? ["full_name", "passport_number", "pan_number"] : ["full_name", "passport_number", "address", "pan_number"];
}
export const FIELD_LABELS: Record<string, string> = { full_name: "name", passport_number: "passport number", address: "address", pan_number: "PAN number" };

export type Completeness = {
  missingDocs: string[];
  missingFields: string[];
  /** PAR and hotel booking both uploaded: this passenger can go straight to the visa. */
  ready: boolean;
  complete: boolean;
};

export function passengerCompleteness(p: Pick<PassengerView, "full_name" | "passport_number" | "address" | "pan_number" | "documents">, kind: ApplicationKind): Completeness {
  const present = new Set(p.documents.map((d) => d.doc_type));
  const missingDocs = PORTAL_DOCS.filter((d) => d.need && !present.has(d.type)).map((d) => d.type);
  const missingFields = requiredFields(kind).filter((f) => !(p[f] ?? "").toString().trim());
  return { missingDocs, missingFields, ready: present.has("par") && present.has("hotel_booking"), complete: missingDocs.length === 0 && missingFields.length === 0 };
}

export type ApplicationCompleteness = {
  canSubmit: boolean;
  ready: boolean;
  passengers: { id: string; full_name: string; completeness: Completeness }[];
};

export function applicationCompleteness(a: Pick<ApplicationView, "kind" | "passengers">): ApplicationCompleteness {
  const passengers = a.passengers.map((p) => ({ id: p.id, full_name: p.full_name, completeness: passengerCompleteness(p, a.kind) }));
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
