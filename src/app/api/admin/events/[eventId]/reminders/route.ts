import { NextResponse } from "next/server";
import { eq, asc } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/db";
import { events, timeSlots } from "@/db/schema";
import { sendMail } from "@/lib/mail";

// POST send reminder emails to all reservations for an event
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const db = await getDb();
  const { eventId } = await params;

  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
    with: {
      timeSlots: {
        orderBy: asc(timeSlots.sortOrder),
        with: { reservations: true },
      },
    },
  });

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const { env } = await getCloudflareContext({ async: true });
  const envMap = env as Record<string, string | undefined>;
  const appUrl = envMap.NEXT_PUBLIC_APP_URL || "";
  const adminEmail = envMap.ADMIN_EMAIL;

  const allReservations = event.timeSlots.flatMap((slot) =>
    slot.reservations.map((r) => ({
      ...r,
      startTime: slot.startTime,
      endTime: slot.endTime,
    }))
  );

  let sent = 0;
  let failed = 0;

  for (const r of allReservations) {
    try {
      const cancelUrl = `${appUrl}/reserve/cancel/${r.id}`;
      const additionalNames: string[] = r.additionalNames
        ? (JSON.parse(r.additionalNames) as string[])
        : [];
      const participantsHtml = [r.name, ...additionalNames]
        .map(
          (n, i) =>
            `<div style="padding: 4px 0;">${i + 1}. ${n}</div>`
        )
        .join("");

      await sendMail({
        to: r.email,
        subject: `【リマインダー】${event.title}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>${event.title} のリマインダー</h2>
            <p>${r.name} 様</p>
            <p>ご予約のリマインダーをお送りいたします。</p>
            <table style="border-collapse: collapse; width: 100%;">
              <tr><td style="padding: 8px; font-weight: bold; vertical-align: top;">日付</td><td style="padding: 8px;">${event.date}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold; vertical-align: top;">時間</td><td style="padding: 8px;">${r.startTime} - ${r.endTime}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold; vertical-align: top;">人数</td><td style="padding: 8px;">${r.partySize}名</td></tr>
              ${
                additionalNames.length > 0
                  ? `<tr><td style="padding: 8px; font-weight: bold; vertical-align: top;">参加者</td><td style="padding: 8px;">${participantsHtml}</td></tr>`
                  : ""
              }
              ${event.location ? `<tr><td style="padding: 8px; font-weight: bold; vertical-align: top;">場所</td><td style="padding: 8px;">${event.location}</td></tr>` : ""}
            </table>
            <p style="margin-top: 20px; color: #666;">ご来場をお待ちしております。</p>
            <hr style="margin: 30px 0; border: 0; border-top: 1px solid #eee;" />
            <p style="color: #666; font-size: 14px; margin-bottom: 12px;">
              ご都合が悪くなった場合は、以下のボタンから予約をキャンセルできます。
            </p>
            <div>
              <a href="${cancelUrl}" target="_blank"
                 style="display: inline-block; padding: 10px 20px; background: #ef4444; color: white; text-decoration: none; border-radius: 4px;">
                予約をキャンセルする
              </a>
            </div>
            ${
              r.partySize > 1
                ? `<p style="color: #666; font-size: 13px; margin-top: 16px;">
                    ※ 人数の一部変更をご希望の場合は、恐れ入りますが
                    <a href="mailto:${adminEmail || ""}" style="color: #3b82f6;">${adminEmail || "管理者"}</a>
                    までご連絡ください。
                  </p>`
                : ""
            }
          </div>
        `,
      });
      sent++;
    } catch {
      failed++;
    }
  }

  return NextResponse.json({
    total: allReservations.length,
    sent,
    failed,
  });
}
