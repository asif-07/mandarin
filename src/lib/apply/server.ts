import "server-only";
import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUCKETS } from "@/lib/constants";
import type { ApplicantDoc, ApplicantView } from "@/lib/apply/shared";

export function newPortalToken(): string {
  return randomBytes(24).toString("base64url");
}

const COLS = "id, traveller_ref, portal_token, full_name, phone, email, nationality, passport_number, date_of_birth, sex, passport_expiry, address, pan_number, travel_start_date, travel_end_date, portal_status, portal_submitted_at, portal_ready, status, source, group:travel_groups(group_ref)";

/** The applicant behind a portal link, with signed previews for image documents (1 hour). */
export async function loadApplicantByToken(token: string): Promise<ApplicantView | null> {
  if (!token || token.length < 16 || token.length > 64) return null;
  const supabase = createAdminClient();
  const { data: t } = await supabase.from("travellers").select(COLS).eq("portal_token", token).eq("source", "b2c_portal").maybeSingle();
  if (!t) return null;
  const { data: docs } = await supabase.from("traveller_documents").select("id, doc_type, file_name, file_size, mime_type, storage_path, uploaded_at").eq("traveller_id", t.id).is("deleted_at", null).order("merge_order").order("uploaded_at");
  const imagePaths = (docs ?? []).filter((d) => d.mime_type.startsWith("image/")).map((d) => d.storage_path);
  const { data: signed } = imagePaths.length ? await supabase.storage.from(BUCKETS.travellerDocuments).createSignedUrls(imagePaths, 3600) : { data: [] as { path: string | null; signedUrl: string }[] };
  const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  void supabase.from("travellers").update({ portal_last_seen_at: new Date().toISOString() }).eq("id", t.id).then(() => undefined);
  const documents: ApplicantDoc[] = (docs ?? []).map((d) => ({ id: d.id, doc_type: d.doc_type, file_name: d.file_name, file_size: d.file_size, mime_type: d.mime_type, uploaded_at: d.uploaded_at, preview_url: urlByPath.get(d.storage_path) ?? null }));
  return {
    id: t.id,
    traveller_ref: t.traveller_ref,
    token,
    full_name: t.full_name,
    phone: t.phone,
    email: t.email,
    nationality: t.nationality,
    passport_number: t.passport_number,
    date_of_birth: t.date_of_birth,
    sex: t.sex,
    passport_expiry: t.passport_expiry,
    address: t.address,
    pan_number: t.pan_number,
    travel_start_date: t.travel_start_date,
    travel_end_date: t.travel_end_date,
    portal_status: t.portal_status,
    portal_submitted_at: t.portal_submitted_at,
    portal_ready: t.portal_ready,
    status: t.status,
    group_ref: t.group?.group_ref ?? null,
    documents,
  };
}

/** Lightweight token check for the API routes (no documents, no previews). */
export async function applicantIdByToken(token: string): Promise<{ id: string; portal_status: string | null; full_name: string; travel_start_date: string; travel_end_date: string; traveller_ref: string } | null> {
  if (!token || token.length < 16 || token.length > 64) return null;
  const supabase = createAdminClient();
  const { data } = await supabase.from("travellers").select("id, portal_status, full_name, travel_start_date, travel_end_date, traveller_ref").eq("portal_token", token).eq("source", "b2c_portal").maybeSingle();
  return data ?? null;
}

export async function countNewApplications(): Promise<number> {
  const supabase = createAdminClient();
  const { count } = await supabase.from("travellers").select("id", { count: "exact", head: true }).eq("source", "b2c_portal").eq("portal_status", "submitted");
  return count ?? 0;
}
