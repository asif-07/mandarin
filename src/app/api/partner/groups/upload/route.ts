import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPortalPartner } from "@/lib/portal/auth";
import { recordEvent } from "@/lib/workflow/engine";
import { b2bReference, parseB2bCode } from "@/lib/travel/b2b-code";
import { BUCKETS, STANDARD_BORDER } from "@/lib/constants";
import { todayISO } from "@/lib/format";
import { groupRef } from "@/lib/queries/travel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST multipart { file, code } — the partner's bulk upload, the same as the
 * CRM's B2B upload: the code (MR144-EDPT-OCT15-OCT20-100PX-G01) gives the
 * entry and exit dates, pax and partner; the group is created as a draft
 * under the next free code for that date, the PDF is filed as its pack,
 * and the partner only adds flight details before submitting.
 */
export async function POST(request: NextRequest) {
  const partner = await getPortalPartner();
  if (!partner) return NextResponse.json({ error: "Partner sign-in required" }, { status: 401 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const rawCode = String(form?.get("code") ?? "");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose the PDF" }, { status: 400 });
  if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) return NextResponse.json({ error: "Only PDF is accepted" }, { status: 415 });
  if (file.size > 100 * 1024 * 1024) return NextResponse.json({ error: "The file is larger than 100 MB" }, { status: 413 });
  const parsed = parseB2bCode(rawCode, todayISO());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const v = parsed.value;
  if (v.partner_code !== partner.code.toUpperCase()) return NextResponse.json({ error: `The code is for partner ${v.partner_code}; you are signed in as ${partner.code}` }, { status: 400 });

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("create_b2b_group", {
    p: { travel_date: v.travel_date, travel_end_date: v.travel_end_date, reference_prefix: v.prefix, partner_code: v.partner_code, partner_reference: v.normalised, pax_expected: v.pax, label: `${v.partner_code} · ${v.pax} pax`, entry_port: STANDARD_BORDER, exit_port: STANDARD_BORDER },
  });
  const row = data as { id?: string; group_code?: string } | null;
  if (error || !row?.id || !row.group_code) return NextResponse.json({ error: error?.message ?? "Could not create the group" }, { status: 500 });

  const reference = b2bReference({ reference_prefix: v.prefix, partner_code: v.partner_code, travel_date: v.travel_date, travel_end_date: v.travel_end_date, group_code: row.group_code }, v.pax);
  const path = `_b2b/${row.id}/${reference}.pdf`;
  const { error: upErr } = await supabase.storage.from(BUCKETS.travelPacks).upload(path, Buffer.from(await file.arrayBuffer()), { contentType: "application/pdf", upsert: false });
  if (upErr) return NextResponse.json({ error: `Group ${row.group_code} was created but the file could not be filed: ${upErr.message}`, id: row.id }, { status: 500 });
  const now = new Date().toISOString();
  const { error: updErr } = await supabase
    .from("travel_groups")
    .update({ pack_path: path, pack_file_name: `${reference}.pdf`, pack_uploaded_at: now, workflow_status: "draft", workflow_updated_at: now, submitted_by_partner: true, arrival_flight_date: v.travel_date, departure_flight_date: v.travel_end_date })
    .eq("id", row.id);
  if (updErr) return NextResponse.json({ error: updErr.message, id: row.id }, { status: 500 });
  const { data: g } = await supabase.from("travel_groups").select("group_ref, reference_prefix, partner_code, travel_date, travel_end_date, group_code").eq("id", row.id).single();
  const ref = g?.group_ref ?? (g ? groupRef(g) : reference);
  await recordEvent(supabase, row.id, { kind: "partner", name: partner.name }, `Bulk upload: ${file.name} recognised as ${v.normalised}`, { status: "draft", note: `${v.pax} pax · ${v.travel_date} to ${v.travel_end_date}` });
  return NextResponse.json({ ok: true, id: row.id, group_ref: ref, group_code: row.group_code, pax: v.pax, travel_date: v.travel_date, travel_end_date: v.travel_end_date, file_name: `${reference}.pdf` });
}
