export const AUTH_EMAIL_DOMAIN = "mandarinroots.local";
export const TIMEZONE = "Asia/Dubai";
export const PAGE_SIZE = 25;

export const COMPANY = {
  name: "Mandarin Roots",
  addressLine1: "广州市越秀区长堤大马路316号",
  addressLine2: "民州金岁大厦2812房",
  addressLine3: "Guangzhou, China",
  phone: "+8519597408840",
} as const;

export const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: "LayoutDashboard" },
  { href: "/invoices", label: "Invoices", icon: "FileText" },
  { href: "/leads", label: "Leads", icon: "Users" },
  { href: "/travel", label: "Travel", icon: "Plane" },
  { href: "/settings", label: "Settings", icon: "Settings" },
] as const;

export type Option<T extends string = string> = { value: T; label: string; short?: string };

export const ENQUIRY_TYPES = [
  { value: "144hr_visa", label: "144-Hour Visa Free Transit", short: "144hr Visa" },
  { value: "canton_fair_package", label: "Canton Fair Package", short: "Canton Fair" },
  { value: "china_business_visa", label: "China Business Visa (M Visa)", short: "M Visa" },
  { value: "group_tour", label: "Group Tour", short: "Group Tour" },
  { value: "other", label: "Other", short: "Other" },
] as const satisfies readonly Option[];
export type EnquiryType = (typeof ENQUIRY_TYPES)[number]["value"];

export const LEAD_SOURCES = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "referral", label: "Referral" },
  { value: "walk_in", label: "Walk-in" },
  { value: "website", label: "Website" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "other", label: "Other" },
] as const satisfies readonly Option[];
export type LeadSource = (typeof LEAD_SOURCES)[number]["value"];

export const COUNTRIES = [
  { value: "UAE", label: "UAE", code: "AE", flag: "🇦🇪", dial: "AE" },
  { value: "India", label: "India", code: "IN", flag: "🇮🇳", dial: "IN" },
  { value: "Saudi Arabia", label: "Saudi Arabia", code: "SA", flag: "🇸🇦", dial: "SA" },
  { value: "Qatar", label: "Qatar", code: "QA", flag: "🇶🇦", dial: "QA" },
  { value: "Oman", label: "Oman", code: "OM", flag: "🇴🇲", dial: "OM" },
  { value: "Kuwait", label: "Kuwait", code: "KW", flag: "🇰🇼", dial: "KW" },
  { value: "Bahrain", label: "Bahrain", code: "BH", flag: "🇧🇭", dial: "BH" },
  { value: "Other", label: "Other", code: "", flag: "🌐", dial: "" },
] as const;

export const LEAD_STATUSES = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "quoted", label: "Quoted" },
  { value: "negotiating", label: "Negotiating" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
  { value: "on_hold", label: "On Hold" },
] as const satisfies readonly Option[];
export type LeadStatus = (typeof LEAD_STATUSES)[number]["value"];

export const KANBAN_STATUSES: LeadStatus[] = [
  "new",
  "contacted",
  "quoted",
  "negotiating",
  "won",
  "lost",
];

export const LOST_REASONS = [
  { value: "price", label: "Price" },
  { value: "timing", label: "Timing" },
  { value: "went_elsewhere", label: "Went elsewhere" },
  { value: "not_eligible", label: "Not eligible" },
  { value: "no_response", label: "No response" },
  { value: "other", label: "Other" },
] as const satisfies readonly Option[];

export const CANTON_PHASES = [
  { value: "phase_1", label: "Phase 1" },
  { value: "phase_2", label: "Phase 2" },
  { value: "phase_3", label: "Phase 3" },
  { value: "n/a", label: "Not applicable" },
] as const satisfies readonly Option[];

export const ACTIVITY_TYPES = [
  { value: "note", label: "Note" },
  { value: "call", label: "Call" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "meeting", label: "Meeting" },
  { value: "status_change", label: "Status change" },
] as const satisfies readonly Option[];
export type ActivityType = (typeof ACTIVITY_TYPES)[number]["value"];

export const CURRENCIES = [
  { value: "USD", label: "USD · US Dollar" },
  { value: "AED", label: "AED · UAE Dirham" },
  { value: "CNY", label: "CNY · Chinese Yuan" },
  { value: "INR", label: "INR · Indian Rupee" },
] as const satisfies readonly Option[];
export type Currency = (typeof CURRENCIES)[number]["value"];

export const INVOICE_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "issued", label: "Issued" },
  { value: "paid", label: "Paid" },
  { value: "cancelled", label: "Cancelled" },
] as const satisfies readonly Option[];
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]["value"];

export const DEFAULT_TERMS = [
  "Payment due on receipt.",
  "Visa charges are non-refundable once the application is submitted.",
  "All bank transfer charges are borne by the payer.",
].join("\n");

export const QUICK_ADD_ITEMS = [
  { title: "Visa Charges", description: "Visa application and processing fee", rate: 140 },
  { title: "Service Charges", description: "Documentation, coordination and handling", rate: 80 },
  { title: "Canton Fair Package", description: "Canton Fair visit package", rate: 0 },
  { title: "Hotel Booking", description: "Hotel reservation and confirmation", rate: 0 },
  { title: "Airport Transfer", description: "Airport pick-up and drop-off", rate: 0 },
  { title: "Interpreter Service", description: "Professional interpreter service", rate: 0 },
] as const;

export const TRAVELLER_STATUSES = [
  { value: "documents_pending", label: "Documents Pending" },
  { value: "documents_complete", label: "Documents Complete" },
  { value: "visa_applied", label: "Visa Applied" },
  { value: "visa_approved", label: "Visa Approved" },
  { value: "travelled", label: "Travelled" },
  { value: "cancelled", label: "Cancelled" },
] as const satisfies readonly Option[];
export type TravellerStatus = (typeof TRAVELLER_STATUSES)[number]["value"];

export const DOC_TYPES = [
  { value: "par", label: "PAR", mergeOrder: 1, required: true, keywords: ["par", "arrival", "record"] },
  { value: "passport", label: "Passport", mergeOrder: 2, required: true, keywords: ["passport", "ppt", "pp"] },
  { value: "flight_ticket", label: "Flight Ticket", mergeOrder: 3, required: true, keywords: ["ticket", "flight", "itinerary", "boarding", "pnr"] },
  { value: "hotel_booking", label: "Hotel Booking", mergeOrder: 4, required: true, keywords: ["hotel", "booking", "reservation", "accommodation"] },
  { value: "other", label: "Other", mergeOrder: 5, required: false, keywords: [] },
] as const;
export type DocType = (typeof DOC_TYPES)[number]["value"];
export const REQUIRED_DOC_TYPES = DOC_TYPES.filter((d) => d.required).map((d) => d.value);

export const ACCEPTED_UPLOAD_TYPES: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/heic": [".heic"],
  "image/heif": [".heif"],
};
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export const BUCKETS = {
  travellerDocuments: "traveller-documents",
  travelPacks: "travel-packs",
  invoices: "invoices",
} as const;

export function labelFor<T extends string>(options: readonly Option<T>[], value: T | null | undefined) {
  return options.find((o) => o.value === value)?.label ?? value ?? "";
}
