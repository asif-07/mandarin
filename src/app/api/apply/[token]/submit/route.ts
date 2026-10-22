import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { applicantIdByToken } from "@/lib/apply/server";
import { applicantCompleteness, portalDocLabel } from "@/lib/apply/shared";
import { notify } from "@/lib/workflow/engine";
import { emailConfigured, sendEmail } from "@/lib/email/send";
import { COMPANY } from "@/lib/constants";
import { formatDate } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FIELD_LABELS: Record<string, string> = { full_name: "name", passport_number: "passport number", address: "address", pan_number: "PAN number" };

/** POST — the customer submits the application once passport, photo, PAN card and the details are in. Notifies the team. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const applicant = await applicantIdByToken(token);
  if (!applicant) return NextResponse.json({ error: "This link is not valid" }, { status: 404 });
  const supabase = createAdminClient();
  const [{ data: t }, { data: docs }] = await Promise.all([
    supabase.from("travellers").select("id, traveller_ref, full_name, email, phone, passport_number, address, pan_number, nationality, travel_start_date, travel_end_date, portal_status, portal_submitted_at").eq("id", applicant.id).single(),
    supabase.from("traveller_documents").select("id, doc_type, file_name, file_size, mime_type, uploaded_at").eq("traveller_id", applicant.id).is("deleted_at", null),
  ]);
  if (!t) return NextResponse.json({ error: "Application not found" }, { status: 404 });
  const c = applicantCompleteness({ ...t, documents: (docs ?? []).map((d) => ({ ...d, preview_url: null })) });
  if (!c.canSubmit) {
    const missing = [...c.missingDocs.map(portalDocLabel), ...c.missingFields.map((f) => FIELD_LABELS[f] ?? f)];
    return NextResponse.json({ error: `Still missing: ${missing.join(", ")}` }, { status: 400 });
  }
  const first = !t.portal_submitted_at;
  const now = new Date().toISOString();
  const { error } = await supabase.from("travellers").update({ portal_status: "submitted", portal_submitted_at: t.portal_submitted_at ?? now, portal_ready: c.ready }).eq("id", t.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const dates = `${formatDate(t.travel_start_date)} to ${formatDate(t.travel_end_date)}`;
  const present = (docs ?? []).map((d) => portalDocLabel(d.doc_type)).join(", ");
  await notify(supabase, [{ audience: "company" }], null, `${first ? "Customer application" : "Application updated"}: ${t.full_name} · ${dates}`, `${t.traveller_ref}${t.nationality ? ` · ${t.nationality}` : ""} · ${c.ready ? "Has PAR and hotel: can apply directly" : "Needs PAR / hotel from us"} · ${present}${t.phone ? ` · ${t.phone}` : ""}`);

  if (first && t.email && emailConfigured()) {
    const link = `${request.nextUrl.origin}/apply/t/${token}`;
    await sendEmail({
      to: t.email,
      subject: `${COMPANY.name}: your China visa application ${t.traveller_ref}`,
      html: `<p>Dear ${t.full_name},</p><p>We received your application for ${dates} (reference <strong>${t.traveller_ref}</strong>).</p><p>${c.ready ? "You uploaded your PAR and hotel booking, so we can apply directly." : "We will prepare the PAR and hotel details from your passport and contact you."}</p><p>Your private link to add or change documents: <a href="${link}">${link}</a></p><p>${COMPANY.name}<br/>${COMPANY.phone}</p>`,
      text: `We received your application ${t.traveller_ref} for ${dates}. Your private link: ${link}`,
    }).catch(() => undefined);
  }
  return NextResponse.json({ ok: true, ready: c.ready, submitted_at: t.portal_submitted_at ?? now });
}
