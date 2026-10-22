/** Shared by the public customer portal and the CRM (no server-only imports). */
import { DOC_TYPES } from "@/lib/constants";

/** Everything the portal needs about one applicant, with no secrets beyond the token the visitor already holds. */
export type ApplicantView = {
  id: string;
  traveller_ref: string;
  token: string;
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
  portal_status: string | null;
  portal_submitted_at: string | null;
  portal_ready: boolean;
  status: string;
  group_ref: string | null;
  documents: ApplicantDoc[];
};

export type ApplicantDoc = {
  id: string;
  doc_type: string;
  file_name: string;
  file_size: number | null;
  mime_type: string;
  uploaded_at: string | null;
  preview_url: string | null;
};

/** What the portal asks for, in order. `need` = must be there before the customer can submit. */
export const PORTAL_DOCS = [
  { type: "passport", need: true, title: "Passport", hint: "Photo of the data page (the page with your photo). We read the details from it automatically." },
  { type: "photo", need: true, title: "Passport-size photo", hint: "Recent colour photo, plain light background, face straight to the camera." },
  { type: "pan_card", need: true, title: "PAN card", hint: "Front side, all details readable." },
  { type: "par", need: false, title: "PAR", hint: "If you already hold a PAR, upload it and we apply directly. Otherwise we prepare it from your passport." },
  { type: "hotel_booking", need: false, title: "Hotel booking", hint: "Confirmation with your name and the dates, if you have booked already." },
  { type: "flight_ticket", need: false, title: "Flight ticket", hint: "E-ticket or itinerary, if booked." },
] as const;
export type PortalDocType = (typeof PORTAL_DOCS)[number]["type"];

export function portalDocLabel(type: string): string {
  return PORTAL_DOCS.find((d) => d.type === type)?.title ?? DOC_TYPES.find((d) => d.value === type)?.label ?? type;
}

/** Profile fields the customer must fill before submitting. */
export const PORTAL_REQUIRED_FIELDS = ["full_name", "passport_number", "address", "pan_number"] as const;

export type Completeness = {
  missingDocs: string[];
  missingFields: string[];
  /** PAR and hotel booking both uploaded: the application can go straight to the visa. */
  ready: boolean;
  canSubmit: boolean;
};

export function applicantCompleteness(a: Pick<ApplicantView, "full_name" | "passport_number" | "address" | "pan_number" | "documents">): Completeness {
  const present = new Set(a.documents.map((d) => d.doc_type));
  const missingDocs = PORTAL_DOCS.filter((d) => d.need && !present.has(d.type)).map((d) => d.type);
  const missingFields = PORTAL_REQUIRED_FIELDS.filter((f) => !(a[f] ?? "").toString().trim());
  return {
    missingDocs,
    missingFields,
    ready: present.has("par") && present.has("hotel_booking"),
    canSubmit: missingDocs.length === 0 && missingFields.length === 0,
  };
}
