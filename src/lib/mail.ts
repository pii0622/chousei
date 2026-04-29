import { getCloudflareContext } from "@opennextjs/cloudflare";

interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  fromEmail?: string;
  fromName?: string;
  replyTo?: string;
}

export async function sendMail({
  to,
  subject,
  html,
  text,
  fromEmail,
  fromName,
  replyTo,
}: SendMailOptions) {
  const { env } = await getCloudflareContext({ async: true });
  const envMap = env as Record<string, string | undefined>;
  const apiKey = envMap.SENDGRID_API_KEY;

  if (!apiKey) {
    console.log("[Mail] SENDGRID_API_KEY not set. Skipping email to:", to);
    return;
  }

  if (!fromEmail) {
    console.log(
      "[Mail] No verified sender email. Skipping email to:",
      to,
      "Subject:",
      subject
    );
    return;
  }

  const from = {
    email: fromEmail,
    ...(fromName ? { name: fromName } : {}),
  };

  const content: { type: string; value: string }[] = [];
  if (text) content.push({ type: "text/plain", value: text });
  content.push({ type: "text/html", value: html });

  const body: Record<string, unknown> = {
    personalizations: [{ to: [{ email: to }] }],
    from,
    subject,
    content,
  };

  if (replyTo) {
    body.reply_to = { email: replyTo };
  }

  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error("[Mail] SendGrid error:", res.status, errorText);
    throw new Error(`SendGrid error: ${res.status}`);
  }
}

// --- Sender Verification ---

interface VerifiedSender {
  id: number;
  from_email: string;
  verified: boolean;
}

export async function getVerifiedSenders(): Promise<VerifiedSender[]> {
  const { env } = await getCloudflareContext({ async: true });
  const apiKey = (env as Record<string, string | undefined>).SENDGRID_API_KEY;
  if (!apiKey) return [];

  const res = await fetch(
    "https://api.sendgrid.com/v3/verified_senders",
    {
      headers: { Authorization: `Bearer ${apiKey}` },
    }
  );

  if (!res.ok) return [];
  const data = (await res.json()) as { results?: VerifiedSender[] };
  return data.results || [];
}

export async function isEmailVerified(email: string): Promise<boolean> {
  const senders = await getVerifiedSenders();
  return senders.some(
    (s) => s.from_email.toLowerCase() === email.toLowerCase() && s.verified
  );
}

export async function requestSenderVerification(
  email: string,
  name: string
): Promise<{ ok: boolean; error?: string }> {
  const { env } = await getCloudflareContext({ async: true });
  const apiKey = (env as Record<string, string | undefined>).SENDGRID_API_KEY;
  if (!apiKey) return { ok: false, error: "SENDGRID_API_KEY not set" };

  const res = await fetch(
    "https://api.sendgrid.com/v3/verified_senders",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        nickname: name,
        from_email: email,
        from_name: name,
        reply_to: email,
        reply_to_name: name,
        address: "Japan",
        city: "Tokyo",
        country: "JP",
      }),
    }
  );

  if (!res.ok) {
    const errorText = await res.text();
    // Already verified or pending
    if (res.status === 400 && errorText.includes("already")) {
      return { ok: true };
    }
    console.error("[Mail] Sender verification error:", res.status, errorText);
    return { ok: false, error: errorText };
  }

  return { ok: true };
}
