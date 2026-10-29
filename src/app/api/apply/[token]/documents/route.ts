import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { applicationByToken, passengerBelongs } from "@/lib/apply/server";
import { PORTAL_DOCS } from "@/lib/apply/shared";
import { reconcileDocumentStatus } from "@/lib/actions/travellers";
import { ACCEPTED_UPLOAD_TYPES, BUCKETS, DOC_TYPES, MAX_UPLOAD_BYTES } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PORTAL_TYPES = new Set<string>(PORTAL_DOCS.map((d) => d.type));

function mimeFor(file: File): string | null {
  if (file.type && ACCEPTED_UPLOAD_TYPES[file.type]) return file.type;
  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
  return Object.entries(ACCEPTED_UPLOAD_TYPES).find(([, exts]) => exts.includes(ext))?.[0] ?? null;
}

/**
 * POST multipart { file, doc_type, traveller_id } — one document into a
 * passenger's slot (passport, photo, PAN card, PAR, hotel, flight). A
 * previous file in the same slot is replaced (soft-deleted, kept for audit).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const app = await applicationByToken(token);
  if (!app) return NextResponse.json({ error: "This link is not valid" }, { status: 404 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const docType = String(form?.get("doc_type") ?? "");
  const travellerId = String(form?.get("traveller_id") ?? "");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a file" }, { status: 400 });
  if (!PORTAL_TYPES.has(docType)) return NextResponse.json({ error: "Unknown document type" }, { status: 400 });
  if (!(await passengerBelongs(app.id, travellerId))) return NextResponse.json({ error: "Passenger not found" }, { status: 404 });
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "The file is larger than 15 MB" }, { status: 413 });
  let mime = mimeFor(file);
  if (!mime) return NextResponse.json({ error: "Only PDF, JPG, PNG or HEIC files are accepted" }, { status: 415 });

  const supabase = createAdminClient();
  let bytes = Buffer.from(await file.arrayBuffer());
  let fileName = file.name.replace(/[^\w.\- ()]+/g, "_").slice(-150) || "document";
  if (mime === "image/heic" || mime === "image/heif") {
    try {
      const convert = (await import("heic-convert")).default;
      bytes = Buffer.from(await convert({ buffer: new Uint8Array(bytes), format: "JPEG", quality: 0.9 }));
      mime = "image/jpeg";
      fileName = fileName.replace(/\.(heic|heif)$/i, "") + ".jpg";
    } catch (e) {
      return NextResponse.json({ error: `Could not convert the HEIC photo: ${e instanceof Error ? e.message : "unknown error"}. Please upload a JPG.` }, { status: 415 });
    }
  }
  const safe = fileName.replace(/[^\w.\-]+/g, "_");
  const path = `${travellerId}/${docType}/${crypto.randomUUID()}-${safe}`;
  const { error: upErr } = await supabase.storage.from(BUCKETS.travellerDocuments).upload(path, bytes, { contentType: mime, upsert: false });
  if (upErr) return NextResponse.json({ error: `Upload failed: ${upErr.message}` }, { status: 500 });

  const meta = DOC_TYPES.find((d) => d.value === docType)!;
  await supabase.from("traveller_documents").update({ deleted_at: new Date().toISOString() }).eq("traveller_id", travellerId).eq("doc_type", docType).is("deleted_at", null);
  const { data: row, error } = await supabase
    .from("traveller_documents")
    .insert({ traveller_id: travellerId, doc_type: docType, file_name: fileName, storage_path: path, mime_type: mime, file_size: bytes.byteLength, merge_order: meta.mergeOrder })
    .select("id, doc_type, file_name, file_size, mime_type, uploaded_at, storage_path")
    .single();
  if (error || !row) return NextResponse.json({ error: error?.message ?? "Could not save the document" }, { status: 500 });
  const newStatus = await reconcileDocumentStatus(supabase, travellerId);
  const { data: signed } = mime.startsWith("image/") ? await supabase.storage.from(BUCKETS.travellerDocuments).createSignedUrl(path, 3600) : { data: null };
  return NextResponse.json({ ok: true, newStatus, traveller_id: travellerId, document: { id: row.id, doc_type: row.doc_type, file_name: row.file_name, file_size: row.file_size, mime_type: row.mime_type, uploaded_at: row.uploaded_at, preview_url: signed?.signedUrl ?? null } });
}

/** DELETE { id } — remove an uploaded document (soft delete). */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const app = await applicationByToken(token);
  if (!app) return NextResponse.json({ error: "This link is not valid" }, { status: 404 });
  const body = (await request.json().catch(() => null)) as { id?: string } | null;
  if (!body?.id) return NextResponse.json({ error: "Which document?" }, { status: 400 });
  const supabase = createAdminClient();
  const { data: doc } = await supabase.from("traveller_documents").select("id, traveller_id, traveller:travellers!inner(portal_application_id)").eq("id", body.id).is("deleted_at", null).maybeSingle();
  if (!doc || doc.traveller?.portal_application_id !== app.id || !doc.traveller_id) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  const { error } = await supabase.from("traveller_documents").update({ deleted_at: new Date().toISOString() }).eq("id", doc.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const newStatus = await reconcileDocumentStatus(supabase, doc.traveller_id);
  return NextResponse.json({ ok: true, newStatus });
}
