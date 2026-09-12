import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { BUCKETS } from "@/lib/constants";
import { PDFDocument } from "pdf-lib";
import { imageToPdfPage } from "@/lib/pdf/travel-pack";
import { groupPackReference } from "@/lib/queries/travel";
import { recordGroupVisa } from "@/lib/actions/travel-groups";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/groups/:id/visa -> short-lived signed download of the group's visa page. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const current = await getCurrentProfile();
  if (!current) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const supabase = await createClient();
  const { data: group } = await supabase.from("travel_groups").select("visa_path, visa_file_name").eq("id", id).maybeSingle();
  if (!group?.visa_path) return NextResponse.json({ error: "No visa uploaded for this group" }, { status: 404 });
  const { data: signed, error } = await supabase.storage.from(BUCKETS.travelPacks).createSignedUrl(group.visa_path, 120, { download: group.visa_file_name ?? "visa.pdf" });
  if (error || !signed) return NextResponse.json({ error: "Could not create download link" }, { status: 500 });
  return NextResponse.redirect(signed.signedUrl, { status: 302 });
}

/**
 * POST /api/groups/:id/visa  { upload_path, original_name, mime_type }
 * Files a visa uploaded by the browser. A PDF (in travel-packs) is moved into
 * place; a photo (JPG / PNG / HEIC in traveller-documents) is converted to a
 * one-page A4 PDF first. Lives in an API route because sharp's binaries are
 * only bundled for /api on Vercel.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const current = await getCurrentProfile();
  if (!current) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { upload_path?: string; original_name?: string; mime_type?: string } | null;
  const uploadPath = body?.upload_path ?? "";
  const mimeType = body?.mime_type ?? "application/pdf";
  if (!uploadPath.startsWith("_visa/incoming/")) return NextResponse.json({ error: "Upload the visa file first" }, { status: 400 });
  const supabase = await createClient();
  const { data: g } = await supabase
    .from("travel_groups")
    .select("id, travel_date, travel_end_date, group_code, reference_prefix, source, partner_code, pax_expected, travellers(count)")
    .eq("id", id)
    .maybeSingle();
  if (!g) return NextResponse.json({ error: "Group not found" }, { status: 404 });
  const pax = Array.isArray(g.travellers) ? Number(g.travellers[0]?.count ?? 0) : 0;
  const reference = groupPackReference(g, pax);
  const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const fileName = `${reference}-VISA.pdf`;
  const finalPath = `_visa/${g.id}/${stamp}/${fileName}`;

  try {
    if (mimeType.startsWith("image/")) {
      const { data: blob, error: dlError } = await supabase.storage.from(BUCKETS.travellerDocuments).download(uploadPath);
      if (dlError || !blob) throw dlError ?? new Error("Download failed");
      let bytes = new Uint8Array(await blob.arrayBuffer());
      if (mimeType === "image/heic" || mimeType === "image/heif") {
        const convert = (await import("heic-convert")).default;
        bytes = new Uint8Array(await convert({ buffer: bytes, format: "JPEG", quality: 0.9 }));
      }
      const doc = await PDFDocument.create();
      await imageToPdfPage(doc, bytes);
      doc.setTitle(`${reference} - Visa`);
      const pdf = await doc.save();
      const { error: upError } = await supabase.storage.from(BUCKETS.travelPacks).upload(finalPath, Buffer.from(pdf), { contentType: "application/pdf", upsert: false });
      if (upError) throw upError;
      await supabase.storage.from(BUCKETS.travellerDocuments).remove([uploadPath]);
    } else {
      const { error: moveError } = await supabase.storage.from(BUCKETS.travelPacks).move(uploadPath, finalPath);
      if (moveError) throw moveError;
    }
  } catch (e) {
    console.error("visa filing failed", e);
    return NextResponse.json({ error: `Could not file the visa: ${e instanceof Error ? e.message : "unknown error"}` }, { status: 500 });
  }
  const res = await recordGroupVisa(supabase, id, current.profile?.id ?? current.user.id, finalPath, fileName);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 500 });
  return NextResponse.json({ file_name: `${fileName} (from ${body?.original_name ?? "upload"})` });
}
