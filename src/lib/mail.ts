import { Resend } from "resend";
import { getCloudflareContext } from "@opennextjs/cloudflare";

interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendMail({ to, subject, html }: SendMailOptions) {
  const { env } = await getCloudflareContext({ async: true });
  const apiKey = (env as Record<string, string | undefined>).RESEND_API_KEY;
  const from =
    (env as Record<string, string | undefined>).MAIL_FROM ||
    "onboarding@resend.dev";

  if (!apiKey) {
    console.log("[Mail] RESEND_API_KEY not set. Skipping email to:", to);
    console.log("[Mail] Subject:", subject);
    return;
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to,
    subject,
    html,
  });

  if (error) {
    console.error("[Mail] Resend error:", error);
    throw new Error(error.message);
  }
}
