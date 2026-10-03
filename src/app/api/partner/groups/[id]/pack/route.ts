import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPortalPartner } from "@/lib/portal/auth";
import { recordEvent } from "@/lib/workflow/engine";
import { b2bReference } from "@/lib/travel/b2b-code";
import { BUCKETS } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** POST multipart { file } — the partner's bulk traveller document PDF, filed under our reference like a pack uploaded by staff. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const partner = await getPortalPartner();
  if (!partner) return NextResponse.json({ error: "Partner sign-in required" }, { status: 401 });
  const { id } = await params;
  const supabase = createAdminClient();
  const { data: g } = await supabase.from("travel_groups").select("id, partner_code, workflow_status, reference_prefix, travel_date, travel_end_date, group_code, pax_expected").eq("id", id).maybeSingle();
  if (!g || g.partner_code !== partner.code) return NextResponse.json({ error: "Group not found" }, { status: 404 });
  if (!["draft", "correction_requested"].includes(g.workflow_status ?? "")) return NextResponse.json({ error: "Documents can only be changed before submission" }, { status: 409 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose the PDF" }, { status: 400 });
  if (file.type !== "application/pdf") return NextResponse.json({ error: "Only PDF is accepted for the bulk documents" }, { status: 415 });
  if (file.size > 100 * 1024 * 1024) return NextResponse.json({ error: "The file is larger than 100 MB" }, { status: 413 });
  const reference = b2bReference({ reference_prefix: g.reference_prefix, partner_code: g.partner_code, travel_date: g.travel_date, travel_end_date: g.travel_end_date, group_code: g.group_code }, g.pax_expected ?? 0);
  const path = `_b2b/${g.id}/${Date.now()}-${reference}.pdf`;
  const { error: upErr } = await supabase.storage.from(BUCKETS.travelPacks).upload(path, Buffer.from(await file.arrayBuffer()), { contentType: "application/pdf", upsert: false });
  if (upErr) return NextResponse.json({ error: `Upload failed: ${upErr.message}` }, { status: 500 });
  const { error } = await supabase.from("travel_groups").update({ pack_path: path, pack_file_name: `${reference}.pdf`, pack_uploaded_at: new Date().toISOString() }).eq("id", g.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await recordEvent(supabase, g.id, { kind: "partner", name: partner.name }, `Traveller documents uploaded (${file.name})`);
  return NextResponse.json({ ok: true, file_name: `${reference}.pdf` });
}
