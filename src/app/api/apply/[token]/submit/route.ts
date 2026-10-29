import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { applicationByToken, loadApplicationByToken } from "@/lib/apply/server";
import { applicationCompleteness, missingSummary } from "@/lib/apply/shared";
import { notify } from "@/lib/workflow/engine";
import { emailConfigured, sendEmail } from "@/lib/email/send";
import { COMPANY } from "@/lib/constants";
import { formatDate } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST — submit the application once every passenger has passport, photo, PAN card and the details. Notifies the team. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const core = await applicationByToken(token);
  if (!core) return NextResponse.json({ error: "This link is not valid" }, { status: 404 });
  const app = await loadApplicationByToken(token);
  if (!app) return NextResponse.json({ error: "Application not found" }, { status: 404 });
  const c = applicationCompleteness(app);
  if (!c.canSubmit) {
    const missing = app.passengers.length === 0 ? "at least one passenger" : c.passengers.filter((p) => !p.completeness.complete).map((p) => `${p.full_name}: ${missingSummary(p.completeness)}`).join(" · ");
    return NextResponse.json({ error: `Still missing — ${missing}` }, { status: 400 });
  }
  const supabase = createAdminClient();
  const first = !app.submitted_at;
  const now = new Date().toISOString();
  const submittedAt = app.submitted_at ?? now;
  const { error } = await supabase.from("portal_applications").update({ status: "submitted", submitted_at: submittedAt, ready: c.ready }).eq("id", app.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // Keep the per-passenger mirror in step (the traveller list and older views read it).
  await supabase.from("travellers").update({ portal_status: "submitted", portal_submitted_at: submittedAt }).eq("portal_application_id", app.id);
  for (const p of c.passengers) await supabase.from("travellers").update({ portal_ready: p.completeness.ready }).eq("id", p.id);

  const dates = `${formatDate(app.travel_start_date)} to ${formatDate(app.travel_end_date)}`;
  const who = app.kind === "b2b" ? `${app.agency_name ?? app.contact_name} (agent)` : app.contact_name;
  const n = app.passengers.length;
  await notify(supabase, [{ audience: "company" }], null, `${first ? "Documents received" : "Documents updated"}: ${who} · ${n} passenger${n === 1 ? "" : "s"} · ${dates}`, `${app.passengers.map((p) => p.full_name).join(", ")} · ${c.ready ? "PAR and hotel for everyone: can apply directly" : "Needs PAR / hotel from us"}${app.contact_phone ? ` · ${app.contact_phone}` : ""}`);

  if (first && app.contact_email && emailConfigured()) {
    const link = `${request.nextUrl.origin}/apply/t/${token}`;
    await sendEmail({
      to: app.contact_email,
      subject: `${COMPANY.name}: documents received for ${dates}`,
      html: `<p>Dear ${app.contact_name},</p><p>We received the documents for ${n} passenger${n === 1 ? "" : "s"} travelling ${dates}.</p><p>${c.ready ? "PAR and hotel booking are in, so we can apply directly." : "We will prepare the PAR and hotel details and contact you."}</p><p>Your private link to add or change documents: <a href="${link}">${link}</a></p><p>${COMPANY.name}<br/>${COMPANY.phone}</p>`,
      text: `We received the documents for ${n} passenger(s) travelling ${dates}. Your private link: ${link}`,
    }).catch(() => undefined);
  }
  return NextResponse.json({ ok: true, ready: c.ready, submitted_at: submittedAt });
}
