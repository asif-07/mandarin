import "server-only";

/**
 * Outbound email through Resend's HTTPS API when RESEND_API_KEY (and
 * optionally EMAIL_FROM) are set. Without a key nothing is sent and the
 * caller records the message as skipped, so the workflow never blocks on
 * email. Attachments are base64 encoded inline (visa PDFs are small).
 */
export type EmailAttachment = { filename: string; content: Uint8Array; contentType?: string };
export type SendResult = { status: "sent" | "skipped" | "failed"; error?: string; id?: string };

export function emailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export async function sendEmail(input: { to: string; subject: string; html: string; text?: string; attachments?: EmailAttachment[] }): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { status: "skipped", error: "RESEND_API_KEY is not set" };
  const from = process.env.EMAIL_FROM || "China Travel Support <onboarding@resend.dev>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
        attachments: (input.attachments ?? []).map((a) => ({ filename: a.filename, content: Buffer.from(a.content).toString("base64"), content_type: a.contentType })),
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
    if (!res.ok) return { status: "failed", error: body.message ?? `${res.status} ${body.name ?? res.statusText}` };
    return { status: "sent", id: body.id };
  } catch (e) {
    return { status: "failed", error: e instanceof Error ? e.message : "network error" };
  }
}
