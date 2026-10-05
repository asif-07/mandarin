export const AUTH_EMAIL_DOMAIN = "mandarinroots.local";
export const TIMEZONE = "Asia/Dubai";
export const PAGE_SIZE = 25;

export const COMPANY = {
  name: "Mandarin Roots",
  addressLine1: "广州市越秀区长堤大马路316号",
  addressLine2: "民州金岁大厦2812房",
  addressLine3: "Guangzhou, China",
  phone: "+8619587408840",
} as const;

export const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: "LayoutDashboard", adminOnly: false },
  { href: "/invoices", label: "Invoices", icon: "FileText", adminOnly: false },
  { href: "/leads", label: "Leads", icon: "Users", adminOnly: false },
  { href: "/travel", label: "Travel", icon: "Plane", adminOnly: false },
  { href: "/accounts", label: "Accounts", icon: "Wallet", adminOnly: true },
  { href: "/settings", label: "Settings", icon: "Settings", adminOnly: false },
] as const;

export type Option<T extends string = string> = { value: T; label: string; short?: string };

export const ENQUIRY_TYPES = [
  { value: "144hr_visa", label: "144-Hour Visa Free Transit", short: "144hr Visa" },
  { value: "canton_fair_package", label: "Canton Fair Package", short: "Canton Fair" },
  { value: "china_business_visa", label: "China Business Visa (M Visa)", short: "M Visa" },
  { value: "group_tour", label: "Group Tour", short: "Group Tour" },
  { value: "package", label: "Package (Visa / Transit / Hotel)", short: "Package" },
  { value: "other", label: "Other", short: "Other" },
] as const satisfies readonly Option[];
export type EnquiryType = (typeof ENQUIRY_TYPES)[number]["value"];

/** Package options, used on leads and travellers with enquiry type "package". */
/** Product / Service master kinds. The kind decides which details a group asks for. */
export const SERVICE_KINDS = [
  { value: "airport_transfer", label: "Airport transfer", short: "Transfer" },
  { value: "general", label: "General service", short: "Service" },
] as const satisfies readonly Option[];
export type ServiceKind = (typeof SERVICE_KINDS)[number]["value"];

export const TRANSFER_MODES = [
  { value: "private_chauffeur", label: "Private Chauffeur" },
  { value: "seat_in_coach", label: "Seat in Coach" },
  { value: "private_bus", label: "Private Bus" },
  { value: "other", label: "Other" },
] as const satisfies readonly Option[];
export type TransferMode = (typeof TRANSFER_MODES)[number]["value"];

export const PACKAGE_TIERS = [
  { value: "visa_only", label: "Visa Only", short: "Visa" },
  { value: "visa_par", label: "Visa + PAR", short: "Visa+PAR" },
  { value: "visa_par_transit", label: "Visa + PAR + Transit", short: "Visa+PAR+Transit" },
  { value: "visa_transit", label: "Visa + Transit", short: "Visa+Transit" },
  { value: "visa_transit_hotel", label: "Visa + Transit + Hotel", short: "Visa+Transit+Hotel" },
  { value: "visa_par_hotel_transport", label: "Visa + PAR + Hotel + Transport", short: "Visa+PAR+Hotel+Transport" },
] as const satisfies readonly Option[];

/** Packages that include a hotel (hotel name can be recorded). */
export const HOTEL_TIERS = ["visa_transit_hotel", "visa_par_hotel_transport"] as const;
export function tierHasHotel(tier: string | null | undefined): boolean {
  return !!tier && (HOTEL_TIERS as readonly string[]).includes(tier);
}
/** Packages that must say which hotel class (3, 4 or 5 star). */
export function tierNeedsStars(tier: string | null | undefined): boolean {
  return tier === "visa_par_hotel_transport";
}
/** Packages that include a transit leg (an optional transit location can be recorded). */
export function tierHasTransit(tier: string | null | undefined): boolean {
  return tier === "visa_transit" || tier === "visa_transit_hotel" || tier === "visa_par_transit" || tier === "visa_par_hotel_transport";
}
export const TRANSIT_LOCATIONS = ["Shenzhen Bay Border", "Guangzhou", "Foshan"] as const;
export const HOTEL_STARS = [3, 4, 5] as const;
export type HotelStars = (typeof HOTEL_STARS)[number];
/** "Visa + PAR + Hotel + Transport · 4-star · Marriott" style label for a package with its hotel details. */
export function packageDetail(tier: string | null | undefined, hotel_stars?: number | null, hotel_name?: string | null, transit_location?: string | null): string {
  if (!tier) return "";
  const parts = [labelFor(PACKAGE_TIERS, tier)];
  if (hotel_stars) parts.push(`${hotel_stars}-star`);
  if (hotel_name) parts.push(hotel_name);
  if (transit_location) parts.push(`via ${transit_location}`);
  return parts.join(" · ");
}

/** Documents that can be uploaded once for a whole group instead of per traveller. */
export const GROUP_DOC_TYPES = [
  { value: "flight_ticket", label: "Group flight ticket", covers: "flight_ticket" },
  { value: "hotel_booking", label: "Group hotel booking", covers: "hotel_booking" },
] as const;
export type GroupDocType = (typeof GROUP_DOC_TYPES)[number]["value"];

/** Where a travel group came from. */
export const GROUP_SOURCES = [
  { value: "internal", label: "Our group" },
  { value: "b2b", label: "B2B partner" },
] as const satisfies readonly Option[];
export type PackageTier = (typeof PACKAGE_TIERS)[number]["value"];

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

/** Common China entry / exit ports for group visas; free text is also accepted. */
export const CHINA_PORTS = [
  "Guangzhou Baiyun International Airport (CAN)",
  "Shenzhen Bao'an International Airport (SZX)",
  "Shenzhen Bay Port",
  "Huanggang Port (Shenzhen)",
  "Futian Port (Shenzhen)",
  "Luohu Port (Shenzhen)",
  "Liantang Port (Shenzhen)",
  "Wenjindu Port (Shenzhen)",
  "Shekou Port (Shenzhen)",
  "Gongbei Port (Zhuhai)",
  "Hengqin Port (Zhuhai)",
  "Hong Kong-Zhuhai-Macao Bridge Port",
  "Shanghai Pudong International Airport (PVG)",
  "Beijing Capital International Airport (PEK)",
  "Beijing Daxing International Airport (PKX)",
  "Hangzhou Xiaoshan International Airport (HGH)",
  "Chengdu Tianfu International Airport (TFU)",
  "Xiamen Gaoqi International Airport (XMN)",
] as const;

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
  partnerLogos: "partner-logos",
  transferTickets: "transfer-tickets",
} as const;

/** Neutral ground-service brand printed on transfer vouchers and the partner scanner. */
export const GROUND_BRAND = { name: "China Travel Support", short: "CTS" } as const;

/**
 * Group workflow from partner submission to China exit. `label` is the
 * company wording, `b2b` what the partner portal shows, `visa` what the
 * China Visa Team sees. Groups created by hand before this flow have no
 * workflow status until they are sent to the Visa Team.
 */
export const WORKFLOW_STATUSES = [
  { value: "draft", label: "Draft", b2b: "DRAFT", visa: "Draft", tone: "muted" },
  { value: "submitted", label: "Submitted — pending CTS approval", b2b: "SUBMITTED — PENDING CTS APPROVAL", visa: "Awaiting CTS approval", tone: "warning" },
  { value: "correction_requested", label: "Correction requested", b2b: "CORRECTION REQUIRED", visa: "Correction requested", tone: "red" },
  { value: "rejected", label: "Rejected", b2b: "REJECTED", visa: "Rejected", tone: "red" },
  { value: "company_approved", label: "CTS approved — forwarded to Visa Team", b2b: "IN VISA PROCESSING / FORWARDED TO VISA TEAM", visa: "Ready for processing", tone: "ink" },
  { value: "visa_processing", label: "Visa processing", b2b: "VISA PROCESSING", visa: "Visa processing", tone: "ink" },
  { value: "visa_issued", label: "Visa issued — original copy uploaded, pending CTS approval", b2b: "VISA READY — PENDING CTS APPROVAL", visa: "Visa issued — original copy uploaded", tone: "warning" },
  { value: "visa_approved", label: "Visa approved — available to B2B", b2b: "VISA APPROVED — AVAILABLE FOR DOWNLOAD", visa: "Visa approved / available", tone: "success" },
  { value: "guide_assigned", label: "Guide assigned", b2b: "GUIDE ASSIGNED", visa: "Guide assigned", tone: "success" },
  { value: "travelling_to_china", label: "Travelling to China", b2b: "TRAVELLING TO CHINA", visa: "Travelling to China", tone: "ink" },
  { value: "entry_evidence_uploaded", label: "Entry evidence uploaded", b2b: "ENTRY EVIDENCE UPLOADED", visa: "Entry evidence uploaded", tone: "ink" },
  { value: "travelling_in_china", label: "Travelling in China", b2b: "TRAVELLING IN CHINA", visa: "Travelling in China", tone: "ink" },
  { value: "china_exited", label: "China exited", b2b: "CHINA EXITED", visa: "China exited", tone: "success" },
  { value: "completed", label: "Group completed", b2b: "GROUP COMPLETED", visa: "Group completed", tone: "muted" },
] as const;
export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number]["value"];
export const WORKFLOW_ORDER: readonly WorkflowStatus[] = WORKFLOW_STATUSES.map((s) => s.value);
export function workflowMeta(value: string | null | undefined) {
  return WORKFLOW_STATUSES.find((s) => s.value === value) ?? null;
}

export const VISA_TEAM_ROLES = [
  { value: "visa_processor", label: "Visa processing staff" },
  { value: "team_leader", label: "Team leader" },
  { value: "ground_guide", label: "Ground / guide staff" },
] as const satisfies readonly Option[];

/** The only border supported by the normal B2B submission flow. */
export const STANDARD_BORDER = "Shenzhen Bay Border";

export const VOUCHER_STATUSES = [
  { value: "active", label: "Active" },
  { value: "redeemed", label: "Redeemed" },
  { value: "cancelled", label: "Cancelled" },
] as const satisfies readonly Option[];

/** Group visa lifecycle: pack downloaded = applied; visa page uploaded = approved. */
export const VISA_STATUSES = [
  { value: "pending", label: "Visa not applied" },
  { value: "applied", label: "Visa applied" },
  { value: "approved", label: "Visa received" },
] as const satisfies readonly Option[];
export type VisaStatus = (typeof VISA_STATUSES)[number]["value"];

export function labelFor<T extends string>(options: readonly Option<T>[], value: T | null | undefined) {
  return options.find((o) => o.value === value)?.label ?? value ?? "";
}

// ---------------------------------------------------------------------------
// Accounts (admin only)
// ---------------------------------------------------------------------------
export const PARTY_TYPES = [
  { value: "b2b_partner", label: "B2B partner", short: "Partner" },
  { value: "supplier", label: "Supplier", short: "Supplier" },
  { value: "both", label: "Partner & supplier", short: "Both" },
] as const satisfies readonly Option[];
export type PartyType = (typeof PARTY_TYPES)[number]["value"];

export const DEAL_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
] as const satisfies readonly Option[];
export type DealStatus = (typeof DEAL_STATUSES)[number]["value"];

export const PAYMENT_METHODS = [
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "wechat", label: "WeChat Pay" },
  { value: "alipay", label: "Alipay" },
  { value: "other", label: "Other" },
] as const satisfies readonly Option[];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]["value"];

export const EXPENSE_STATUSES = [
  { value: "unpaid", label: "Unpaid" },
  { value: "paid", label: "Paid" },
] as const satisfies readonly Option[];
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number]["value"];

export const BANK_ACCOUNT_TYPES = [
  { value: "bank", label: "Bank account" },
  { value: "cash", label: "Cash" },
  { value: "wallet", label: "Wallet (WeChat / Alipay)" },
] as const satisfies readonly Option[];
export type BankAccountType = (typeof BANK_ACCOUNT_TYPES)[number]["value"];
