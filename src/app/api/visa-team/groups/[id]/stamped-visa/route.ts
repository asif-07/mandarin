import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVisaMember } from "@/lib/portal/auth";
import { groupPackReference } from "@/lib/queries/travel";
import { recordEvent, transition } from "@/lib/workflow/engine";
import { BUCKETS, WORKFLOW_ORDER } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const EXT: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/heic": "jpg", "image/heif": "jpg" };

/** GET — view the stamped entry visa copy. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const member = await getVisaMember();
  if (!member) return NextResponse.json({ error: "Visa Team sign-in required" }, { status: 401 });
  const { id } = await params;
  const supabase = createAdminClient();
  const { data: g } = await supabase.from("travel_groups").select("stamped_visa_path, stamped_visa_file_name").eq("id", id).maybeSingle();
  if (!g?.stamped_visa_path) return NextResponse.json({ error: "No stamped visa copy" }, { status: 404 });
  const { data: signed, error } = await supabase.storage.from(BUCKETS.travelPacks).createSignedUrl(g.stamped_visa_path, 120, { download: g.stamped_visa_file_name ?? "stamped-visa" });
  if (error || !signed) return NextResponse.json({ error: "Could not create download link" }, { status: 500 });
  return NextResponse.redirect(signed.signedUrl, { status: 302 });
}

/**
 * POST multipart { file } — UPLOAD STAMPED VISA COPY: the guide's photo or
 * scan of the stamped original, saved under the group as
 * CHINA ENTRY — STAMPED VISA. Status becomes ENTRY EVIDENCE UPLOADED;
 * CONFIRM CHINA ENTRY is a separate step.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const member = await getVisaMember();
  if (!member) return NextResponse.json({ error: "Visa Team sign-in required" }, { status: 401 });
  const { id } = await params;
  const supabase = createAdminClient();
  const { data: g } = await supabase.from("travel_groups").select("id, workflow_status, travel_date, travel_end_date, group_code, reference_prefix, source, partner_code, pax_expected").eq("id", id).maybeSingle();
  if (!g || !g.workflow_status) return NextResponse.json({ error: "Group not found" }, { status: 404 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose the photo or scan" }, { status: 400 });
  const mime = file.type || "";
  if (!EXT[mime]) return NextResponse.json({ error: "PDF, JPG, PNG or HEIC only" }, { status: 415 });
  if (file.size > 30 * 1024 * 1024) return NextResponse.json({ error: "The file is larger than 30 MB" }, { status: 413 });

  let bytes = new Uint8Array(await file.arrayBuffer());
  let contentType = mime;
  if (mime === "image/heic" || mime === "image/heif") {
    const convert = (await import("heic-convert")).default;
    bytes = new Uint8Array(await convert({ buffer: bytes, format: "JPEG", quality: 0.9 }));
    contentType = "image/jpeg";
  }
  const reference = groupPackReference(g, g.pax_expected ?? 0);
  const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const fileName = `${reference}-ENTRY-STAMPED-VISA.${EXT[mime]}`;
  const path = `_stamped/${g.id}/${stamp}/${fileName}`;
  const { error: upErr } = await supabase.storage.from(BUCKETS.travelPacks).upload(path, Buffer.from(bytes), { contentType, upsert: false });
  if (upErr) return NextResponse.json({ error: `Upload failed: ${upErr.message}` }, { status: 500 });
  const now = new Date().toISOString();
  const by = `${member.name} (${member.code})`;
  const { error } = await supabase.from("travel_groups").update({ stamped_visa_path: path, stamped_visa_file_name: fileName, stamped_visa_uploaded_at: now, stamped_visa_uploaded_by: by }).eq("id", g.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const at = WORKFLOW_ORDER.indexOf(g.workflow_status as never);
  if (at < WORKFLOW_ORDER.indexOf("travelling_in_china")) {
    const res = await transition(g.id, "entry_evidence_uploaded", { kind: "guide", name: by }, { note: `CHINA ENTRY — STAMPED VISA · ${fileName}` });
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 500 });
  } else {
    await recordEvent(supabase, g.id, { kind: "guide", name: by }, "Stamped visa copy replaced", { note: fileName });
  }
  return NextResponse.json({ ok: true, file_name: fileName });
}
