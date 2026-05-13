/**
 * Tiny Resend client. We use a hand-rolled `fetch` so we don't need to add the
 * `resend` SDK as a runtime dep. The Resend HTTP API is stable and trivial.
 *
 * Required env vars:
 *   RESEND_API_KEY  — API key from resend.com (server-only)
 *   DIGEST_TO_EMAIL — comma-separated list of recipients
 *   DIGEST_FROM_EMAIL — verified sender address (defaults to digest@nulldiary.io)
 *
 * Either var missing → we skip sending and return a `{ skipped: true, reason }`
 * shape so the cron route still returns 200 in development without crashing.
 */

export interface SendResult {
  sent: boolean;
  skipped?: true;
  reason?: string;
  id?: string;
  status?: number;
}

export async function sendDigestEmail(rendered: {
  subject: string;
  text: string;
  html: string;
}): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.DIGEST_TO_EMAIL;
  const from = process.env.DIGEST_FROM_EMAIL ?? "digest@nulldiary.io";

  if (!apiKey || !to) {
    return {
      sent: false,
      skipped: true,
      reason: !apiKey ? "RESEND_API_KEY not set" : "DIGEST_TO_EMAIL not set",
    };
  }

  const recipients = to
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from,
      to: recipients,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    return {
      sent: false,
      reason: `resend ${res.status}: ${body.slice(0, 200)}`,
      status: res.status,
    };
  }

  const data = (await res.json().catch(() => ({}))) as { id?: string };
  return { sent: true, id: data.id, status: res.status };
}
