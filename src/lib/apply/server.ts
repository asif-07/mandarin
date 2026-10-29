import "server-only";
import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUCKETS } from "@/lib/constants";
import type { ApplicantDoc, ApplicationKind, ApplicationView, PassengerView } from "@/lib/apply/shared";

export function newPortalToken(): string {
  return randomBytes(24).toString("base64url");
}

const APP_COLS = "id, token, kind, contact_name, contact_phone, contact_email, agency_name, nationality, travel_start_date, travel_end_date, status, submitted_at, ready, travel_group_id, group:travel_groups(group_ref)";
const PAX_COLS = "id, traveller_ref, full_name, phone, email, nationality, passport_number, date_of_birth, sex, passport_expiry, address, pan_number, travel_start_date, travel_end_date, status, travel_group_id, created_at, group:travel_groups(group_ref), traveller_documents(id, doc_type, file_name, file_size, mime_type, storage_path, uploaded_at, deleted_at)";

export type ApplicationCore = { id: string; kind: ApplicationKind; status: string; contact_name: string; contact_email: string | null; contact_phone: string | null; agency_name: string | null; nationality: string | null; travel_start_date: string; travel_end_date: string; travel_group_id: string | null; submitted_at: string | null };

/** The application behind a token, without passengers (for the API routes). */
export async function applicationByToken(token: string): Promise<ApplicationCore | null> {
  if (!token || token.length < 16 || token.length > 64) return null;
  const supabase = createAdminClient();
  const { data } = await supabase.from("portal_applications").select("id, kind, status, contact_name, contact_email, contact_phone, agency_name, nationality, travel_start_date, travel_end_date, travel_group_id, submitted_at").eq("token", token).maybeSingle();
  return data ? { ...data, kind: data.kind === "b2b" ? "b2b" : "b2c" } : null;
}

/** Full view for the customer's page: passengers with their documents and signed image previews (1 hour). */
export async function loadApplicationByToken(token: string): Promise<ApplicationView | null> {
  if (!token || token.length < 16 || token.length > 64) return null;
  const supabase = createAdminClient();
  const { data: a } = await supabase.from("portal_applications").select(APP_COLS).eq("token", token).maybeSingle();
  if (!a) return null;
  const { data: pax } = await supabase.from("travellers").select(PAX_COLS).eq("portal_application_id", a.id).neq("status", "cancelled").order("created_at");
  const docs = (pax ?? []).flatMap((p) => p.traveller_documents.filter((d) => !d.deleted_at));
  const imagePaths = docs.filter((d) => d.mime_type.startsWith("image/")).map((d) => d.storage_path);
  const { data: signed } = imagePaths.length ? await supabase.storage.from(BUCKETS.travellerDocuments).createSignedUrls(imagePaths, 3600) : { data: [] as { path: string | null; signedUrl: string }[] };
  const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  void supabase.from("portal_applications").update({ last_seen_at: new Date().toISOString() }).eq("id", a.id).then(() => undefined);
  return {
    id: a.id,
    token,
    kind: a.kind === "b2b" ? "b2b" : "b2c",
    contact_name: a.contact_name,
    contact_phone: a.contact_phone,
    contact_email: a.contact_email,
    agency_name: a.agency_name,
    nationality: a.nationality,
    travel_start_date: a.travel_start_date,
    travel_end_date: a.travel_end_date,
    status: a.status,
    submitted_at: a.submitted_at,
    ready: a.ready,
    group_ref: a.group?.group_ref ?? null,
    passengers: (pax ?? []).map((p) => toPassenger(p, urlByPath)),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toPassenger(p: any, urlByPath: Map<string | null, string | null>): PassengerView {
  const documents: ApplicantDoc[] = (p.traveller_documents as { id: string; doc_type: string; file_name: string; file_size: number | null; mime_type: string; storage_path: string; uploaded_at: string | null; deleted_at: string | null }[])
    .filter((d) => !d.deleted_at)
    .sort((x, y) => (x.uploaded_at ?? "").localeCompare(y.uploaded_at ?? ""))
    .map((d) => ({ id: d.id, doc_type: d.doc_type, file_name: d.file_name, file_size: d.file_size, mime_type: d.mime_type, uploaded_at: d.uploaded_at, preview_url: urlByPath.get(d.storage_path) ?? null }));
  return {
    id: p.id,
    traveller_ref: p.traveller_ref,
    full_name: p.full_name,
    phone: p.phone,
    email: p.email,
    nationality: p.nationality,
    passport_number: p.passport_number,
    date_of_birth: p.date_of_birth,
    sex: p.sex,
    passport_expiry: p.passport_expiry,
    address: p.address,
    pan_number: p.pan_number,
    travel_start_date: p.travel_start_date,
    travel_end_date: p.travel_end_date,
    status: p.status,
    group_ref: p.group?.group_ref ?? null,
    grouped: !!p.travel_group_id,
    documents,
  };
}

/** One passenger of an application, as the API returns it after a change. */
export async function loadPassenger(applicationId: string, travellerId: string): Promise<PassengerView | null> {
  const supabase = createAdminClient();
  const { data: p } = await supabase.from("travellers").select(PAX_COLS).eq("id", travellerId).eq("portal_application_id", applicationId).maybeSingle();
  if (!p) return null;
  const imagePaths = p.traveller_documents.filter((d) => !d.deleted_at && d.mime_type.startsWith("image/")).map((d) => d.storage_path);
  const { data: signed } = imagePaths.length ? await supabase.storage.from(BUCKETS.travellerDocuments).createSignedUrls(imagePaths, 3600) : { data: [] as { path: string | null; signedUrl: string }[] };
  return toPassenger(p, new Map((signed ?? []).map((s) => [s.path, s.signedUrl])));
}

/** Is this traveller a passenger of the application? */
export async function passengerBelongs(applicationId: string, travellerId: string): Promise<{ id: string; travel_group_id: string | null } | null> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("travellers").select("id, travel_group_id").eq("id", travellerId).eq("portal_application_id", applicationId).maybeSingle();
  return data ?? null;
}

/** Create one passenger on an application (traveller row with the application's dates). */
export async function createPassenger(app: ApplicationCore, input: { full_name: string; phone?: string | null; email?: string | null; nationality?: string | null; passport_number?: string | null; date_of_birth?: string | null; sex?: string | null; passport_expiry?: string | null; address?: string | null; pan_number?: string | null }): Promise<{ id: string } | { error: string }> {
  const supabase = createAdminClient();
  const year = Number(app.travel_start_date.slice(0, 4));
  const { data: id, error } = await supabase.rpc("create_traveller", {
    p_year: year,
    p_traveller: {
      full_name: input.full_name,
      phone: input.phone ?? null,
      email: input.email ?? null,
      nationality: input.nationality ?? app.nationality,
      passport_number: input.passport_number ?? null,
      travel_start_date: app.travel_start_date,
      travel_end_date: app.travel_end_date,
      status: "documents_pending",
      notes: app.kind === "b2b" ? `Uploaded by ${app.agency_name ?? app.contact_name} through the documents portal` : "Applied through the customer portal",
      source: "b2c_portal",
      portal_status: app.status,
      address: input.address ?? null,
      pan_number: input.pan_number ?? null,
      date_of_birth: input.date_of_birth ?? null,
      sex: input.sex ?? null,
      passport_expiry: input.passport_expiry ?? null,
    },
  });
  if (error || !id) return { error: error?.message ?? "Could not add the passenger" };
  const { error: linkErr } = await supabase.from("travellers").update({ portal_application_id: app.id }).eq("id", id);
  if (linkErr) return { error: linkErr.message };
  return { id };
}

export async function countNewApplications(): Promise<number> {
  const supabase = createAdminClient();
  const { count } = await supabase.from("portal_applications").select("id", { count: "exact", head: true }).eq("status", "submitted");
  return count ?? 0;
}
