import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUCKETS, GROUND_BRAND, workflowMeta, type WorkflowStatus } from "@/lib/constants";
import { groupRef } from "@/lib/queries/travel";
import { sendEmail } from "@/lib/email/send";
import { formatDate } from "@/lib/format";

/**
 * The one place a group's workflow status changes. Writes the status and any
 * extra columns, appends the timeline event and fans out notifications to
 * company, partner and visa team as the requirements list them. Runs with
 * the service role because the partner portal and the visa team extension
 * have no staff session.
 */
export type Actor = { kind: "company" | "partner" | "visa_team" | "guide" | "system"; name: string };
type Admin = ReturnType<typeof createAdminClient>;
type GroupPatch = Record<string, string | number | boolean | null>;

export type GroupCore = { id: string; group_ref: string; partner_code: string | null; travel_date: string; travel_end_date: string; label: string | null; pax_expected: number | null; visa_path: string | null; visa_file_name: string | null; workflow_status: string | null };

export async function loadGroupCore(supabase: Admin, groupId: string): Promise<GroupCore | null> {
  const { data: g } = await supabase.from("travel_groups").select("id, group_ref, reference_prefix, partner_code, source, travel_date, travel_end_date, group_code, label, pax_expected, visa_path, visa_file_name, workflow_status").eq("id", groupId).maybeSingle();
  if (!g) return null;
  return { id: g.id, group_ref: g.group_ref ?? groupRef(g), partner_code: g.partner_code, travel_date: g.travel_date, travel_end_date: g.travel_end_date, label: g.label, pax_expected: g.pax_expected, visa_path: g.visa_path, visa_file_name: g.visa_file_name, workflow_status: g.workflow_status };
}

export async function recordEvent(supabase: Admin, groupId: string, actor: Actor, event: string, opts: { status?: string | null; note?: string | null } = {}): Promise<void> {
  await supabase.from("group_events").insert({ group_id: groupId, actor_kind: actor.kind, actor_name: actor.name, event, status: opts.status ?? null, note: opts.note ?? null });
}

export type NotifyTarget = { audience: "company" | "visa_team" } | { audience: "partner"; partner_code: string };

export async function notify(supabase: Admin, targets: NotifyTarget[], groupId: string | null, title: string, body?: string | null): Promise<void> {
  if (!targets.length) return;
  await supabase.from("notifications").insert(targets.map((t) => ({ audience: t.audience, partner_code: t.audience === "partner" ? t.partner_code : null, group_id: groupId, title, body: body ?? null })));
}

/** Email the approved visa to the partner's registered address and record the outcome on a notification row. */
export async function emailVisaToPartner(supabase: Admin, g: GroupCore): Promise<{ status: string; error?: string }> {
  if (!g.partner_code) return { status: "skipped", error: "not a partner group" };
  const { data: partner } = await supabase.from("b2b_partners").select("email, name").eq("code", g.partner_code).maybeSingle();
  const to = partner?.email?.trim();
  const base = { audience: "partner" as const, partner_code: g.partner_code, group_id: g.id, title: `Visa approved for ${g.group_ref}`, body: "The approved visa is available for download in the partner portal." };
  if (!to) {
    await supabase.from("notifications").insert({ ...base, email_status: "skipped", email_error: "No registered email on the partner record" });
    return { status: "skipped", error: "no email" };
  }
  let attachment: { filename: string; content: Uint8Array; contentType: string } | undefined;
  if (g.visa_path) {
    const { data: file } = await supabase.storage.from(BUCKETS.travelPacks).download(g.visa_path);
    if (file) attachment = { filename: g.visa_file_name ?? `${g.group_ref}-VISA.pdf`, content: new Uint8Array(await file.arrayBuffer()), contentType: "application/pdf" };
  }
  const res = await sendEmail({
    to,
    subject: `Visa approved · ${g.group_ref}`,
    html: `<p>Dear ${partner?.name ?? g.partner_code},</p><p>The China visa for group <b>${g.group_ref}</b> (${formatDate(g.travel_date)} to ${formatDate(g.travel_end_date)}${g.pax_expected ? `, ${g.pax_expected} pax` : ""}) has been approved${attachment ? " and is attached" : ""}. It is also available for download in your partner portal.</p><p>${GROUND_BRAND.name}</p>`,
    attachments: attachment ? [attachment] : [],
  });
  await supabase.from("notifications").insert({ ...base, email_to: to, email_status: res.status, email_error: res.error ?? null });
  if (res.status === "sent") await supabase.from("travel_groups").update({ visa_emailed_at: new Date().toISOString() }).eq("id", g.id);
  return res;
}

/**
 * Move a group to a new workflow status. `patch` carries the columns that
 * belong to the step (timestamps, who confirmed, file paths). Notifications
 * follow the requirements: company on submissions and visa uploads, partner on
 * decisions and progress, visa team when a group is ready for them.
 */
export async function transition(groupId: string, to: WorkflowStatus, actor: Actor, opts: { note?: string | null; patch?: GroupPatch; silent?: boolean } = {}): Promise<{ ok: true; group: GroupCore } | { ok: false; error: string }> {
  const supabase = createAdminClient();
  const g = await loadGroupCore(supabase, groupId);
  if (!g) return { ok: false, error: "Group not found" };
  const now = new Date().toISOString();
  const { error } = await supabase.from("travel_groups").update({ workflow_status: to, workflow_updated_at: now, ...(opts.patch ?? {}) }).eq("id", groupId);
  if (error) return { ok: false, error: error.message };
  const meta = workflowMeta(to);
  await recordEvent(supabase, groupId, actor, meta?.label ?? to, { status: to, note: opts.note ?? null });
  if (!opts.silent) await fanOut(supabase, { ...g, workflow_status: to }, to, actor, opts.note ?? null);
  return { ok: true, group: { ...g, workflow_status: to } };
}

async function fanOut(supabase: Admin, g: GroupCore, to: WorkflowStatus, actor: Actor, note: string | null) {
  const partner: NotifyTarget[] = g.partner_code ? [{ audience: "partner", partner_code: g.partner_code }] : [];
  const company: NotifyTarget[] = [{ audience: "company" }];
  const visa: NotifyTarget[] = [{ audience: "visa_team" }];
  const ref = g.group_ref;
  const by = actor.name ? ` by ${actor.name}` : "";
  switch (to) {
    case "submitted":
      return notify(supabase, company, g.id, `New group submitted: ${ref}`, `${g.partner_code ?? "Partner"} submitted ${ref}${g.pax_expected ? ` (${g.pax_expected} pax)` : ""}. Review and approve, request a correction or reject.`);
    case "correction_requested":
      return notify(supabase, partner, g.id, `Correction required: ${ref}`, note ?? "The company asked for a correction. Open the group, fix it and submit again.");
    case "rejected":
      return notify(supabase, partner, g.id, `Group rejected: ${ref}`, note ?? "The company rejected this submission.");
    case "company_approved":
      await notify(supabase, partner, g.id, `Group approved: ${ref}`, "Your group was approved and forwarded to the China Visa Team.");
      return notify(supabase, visa, g.id, `Ready for processing: ${ref}`, `${ref}${g.pax_expected ? ` · ${g.pax_expected} pax` : ""} · ${formatDate(g.travel_date)} to ${formatDate(g.travel_end_date)}. The application and documents are ready to download.`);
    case "visa_processing":
      await notify(supabase, company, g.id, `Visa processing started: ${ref}`, `The China Visa Team started processing${by}.`);
      return notify(supabase, partner, g.id, `Visa processing: ${ref}`, "The China Visa Team has started processing the visa.");
    case "visa_issued":
      return notify(supabase, company, g.id, `Visa uploaded, review needed: ${ref}`, `The Visa Team uploaded the issued visa${by}. Review and approve it to release it to the partner.`);
    case "visa_approved":
      // The partner notification is written by emailVisaToPartner together with the email outcome.
      return notify(supabase, visa, g.id, `Visa approved: ${ref}`, "The company approved the visa. Ground operations can be arranged.");
    case "guide_assigned":
      await notify(supabase, company, g.id, `Guide assigned: ${ref}`, note);
      return notify(supabase, partner, g.id, `Guide assigned: ${ref}`, note);
    case "travelling_to_china":
      return notify(supabase, [...company, ...partner], g.id, `Travelling to China: ${ref}`, note);
    case "entry_evidence_uploaded":
      return notify(supabase, company, g.id, `Entry evidence uploaded: ${ref}`, `The stamped visa copy was uploaded${by}. Entry is confirmed by the guide separately.`);
    case "travelling_in_china":
      return notify(supabase, [...company, ...partner], g.id, `Travelling in China: ${ref}`, `China entry confirmed${by}.`);
    case "china_exited":
      return notify(supabase, [...company, ...partner], g.id, `China exited: ${ref}`, `Exit confirmed${by}.`);
    case "completed":
      return notify(supabase, partner, g.id, `Group completed: ${ref}`, null);
    default:
      return;
  }
}
