import { NextResponse, type NextRequest } from "next/server";
import { PDFDocument } from "pdf-lib";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVisaMember } from "@/lib/portal/auth";
import { imageToPdfPage } from "@/lib/pdf/travel-pack";
import { groupPackReference } from "@/lib/queries/travel";
import { markGroupVisaApproved } from "@/lib/travel/visa";
import { transition } from "@/lib/workflow/engine";
import { BUCKETS } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET — download the uploaded visa copy. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const member = await getVisaMember();
  if (!member) return NextResponse.json({ error: "Visa Team sign-in required" }, { status: 401 });
  const { id } = await params;
  const supabase = createAdminClient();
  const { data: g } = await supabase.from("travel_groups").select("visa_path, visa_file_name").eq("id", id).maybeSingle();
  if (!g?.visa_path) return NextResponse.json({ error: "No visa on this group" }, { status: 404 });
  const { data: signed, error } = await supabase.storage.from(BUCKETS.travelPacks).createSignedUrl(g.visa_path, 120, { download: g.visa_file_name ?? "visa.pdf" });
  if (error || !signed) return NextResponse.json({ error: "Could not create download link" }, { status: 500 });
  return NextResponse.redirect(signed.signedUrl, { status: 302 });
}

/**
 * POST multipart { file } — the issued visa (PDF, or a photo converted to a
 * one-page PDF). Files it exactly where the CRM's own Upload visa does, so
 * every existing download keeps working, then moves the workflow to
 * VISA ISSUED — ORIGINAL COPY UPLOADED and notifies the company.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const member = await getVisaMember();
  if (!member) return NextResponse.json({ error: "Visa Team sign-in required" }, { status: 401 });
  const { id } = await params;
  const supabase = createAdminClient();
  const { data: g } = await supabase.from("travel_groups").select("id, workflow_status, travel_date, travel_end_date, group_code, reference_prefix, source, partner_code, pax_expected, travellers(count)").eq("id", id).maybeSingle();
  if (!g || !g.workflow_status) return NextResponse.json({ error: "Group not found" }, { status: 404 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose the visa file" }, { status: 400 });
  const mime = file.type || "application/pdf";
  if (!["application/pdf", "image/jpeg", "image/png", "image/heic", "image/heif"].includes(mime)) return NextResponse.json({ error: "PDF, JPG, PNG or HEIC only" }, { status: 415 });
  if (file.size > 30 * 1024 * 1024) return NextResponse.json({ error: "The file is larger than 30 MB" }, { status: 413 });

  const pax = Array.isArray(g.travellers) ? Number(g.travellers[0]?.count ?? 0) : 0;
  const reference = groupPackReference(g, g.pax_expected ?? pax);
  const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const fileName = `${reference}-VISA.pdf`;
  const finalPath = `_visa/${g.id}/${stamp}/${fileName}`;
  try {
    let pdf: Uint8Array;
    if (mime.startsWith("image/")) {
      let bytes = new Uint8Array(await file.arrayBuffer());
      if (mime === "image/heic" || mime === "image/heif") {
        const convert = (await import("heic-convert")).default;
        bytes = new Uint8Array(await convert({ buffer: bytes, format: "JPEG", quality: 0.9 }));
      }
      const doc = await PDFDocument.create();
      await imageToPdfPage(doc, bytes);
      doc.setTitle(`${reference} - Visa`);
      pdf = await doc.save();
    } else pdf = new Uint8Array(await file.arrayBuffer());
    const { error: upErr } = await supabase.storage.from(BUCKETS.travelPacks).upload(finalPath, Buffer.from(pdf), { contentType: "application/pdf", upsert: false });
    if (upErr) throw upErr;
  } catch (e) {
    return NextResponse.json({ error: `Could not file the visa: ${e instanceof Error ? e.message : "unknown error"}` }, { status: 500 });
  }
  const now = new Date().toISOString();
  const { error } = await supabase.from("travel_groups").update({ visa_status: "approved", visa_path: finalPath, visa_file_name: fileName, visa_uploaded_at: now, visa_issued_at: now }).eq("id", g.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await supabase.from("travel_groups").update({ visa_applied_at: now }).eq("id", g.id).is("visa_applied_at", null);
  await markGroupVisaApproved(supabase, g.id);
  const res = await transition(g.id, "visa_issued", { kind: "visa_team", name: `${member.name} (${member.code})` }, { note: `Visa copy ${fileName} uploaded (from ${file.name})` });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 500 });
  return NextResponse.json({ ok: true, file_name: fileName });
}
