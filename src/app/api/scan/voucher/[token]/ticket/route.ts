import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getScannerPartner } from "@/lib/scanner/auth";
import { loadScannerVoucher } from "@/lib/scanner/vouchers";
import { BUCKETS } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ALLOWED: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" };
const MAX_BYTES = 15 * 1024 * 1024;

/** POST multipart { file } — the partner attaches the transport ticket they issued to the guest. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const partner = await getScannerPartner();
  if (!partner) return NextResponse.json({ error: "Authorised partner sign-in required" }, { status: 401 });
  const { token } = await params;
  const found = await loadScannerVoucher(token);
  if (!found) return NextResponse.json({ error: "Voucher not found" }, { status: 404 });
  if (found.voucher.status === "cancelled") return NextResponse.json({ error: "This voucher was cancelled" }, { status: 409 });
  if (found.voucher.status === "redeemed") return NextResponse.json({ error: "This voucher was already redeemed" }, { status: 409 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose the ticket file (PDF, JPG or PNG)" }, { status: 400 });
  const mime = file.type || "";
  const ext = ALLOWED[mime];
  if (!ext) return NextResponse.json({ error: "Only PDF, JPG or PNG tickets are accepted" }, { status: 415 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "The file is larger than 15 MB" }, { status: 413 });

  const supabase = createAdminClient();
  const path = `${found.raw.id}/${Date.now()}-ticket.${ext}`;
  const { error: upErr } = await supabase.storage.from(BUCKETS.transferTickets).upload(path, Buffer.from(await file.arrayBuffer()), { contentType: mime, upsert: false });
  if (upErr) return NextResponse.json({ error: `Upload failed: ${upErr.message}` }, { status: 500 });
  const { error } = await supabase
    .from("transfer_vouchers")
    .update({ ticket_path: path, ticket_file_name: file.name.slice(0, 200) || `ticket.${ext}`, ticket_mime: mime, ticket_uploaded_at: new Date().toISOString(), ticket_partner_id: partner.id })
    .eq("id", found.raw.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const fresh = await loadScannerVoucher(token);
  return NextResponse.json({ ok: true, voucher: fresh?.voucher ?? found.voucher });
}
