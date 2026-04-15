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

  const reserveUrl = `${appUrl}/reserve/${eventId}`;

  for (const r of allReservations) {
    try {
      const cancelUrl = `${appUrl}/reserve/cancel/${r.id}`;
      const additionalNames: string[] = r.additionalNames
        ? (JSON.parse(r.additionalNames) as string[])
        : [];
      const allNames = [r.name, ...additionalNames];
      const participantsText = allNames
        .map((n, i) => `  ${i + 1}. ${n}`)
        .join("\n");

      const text = `${r.name} 様

${event.title} のリマインダーです。

■ 予約内容
日付: ${event.date}
時間: ${r.startTime} - ${r.endTime}
${event.location ? `場所: ${event.location}\n` : ""}人数: ${r.partySize}名${
        additionalNames.length > 0 ? `\n参加者:\n${participantsText}` : ""
      }

■ 予約の詳細・キャンセル
${cancelUrl}

■ お時間を変更したい場合
お手数ですが、新しい時間で予約をお取りいただいた後、上記URLから現在の予約をキャンセルしてください。
新規予約: ${reserveUrl}
${
  r.partySize > 1
    ? `\n※ 人数の一部変更をご希望の場合は、${adminEmail || "管理者"} までご連絡ください。`
    : ""
}

ご来場をお待ちしております。`;

      const html = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#333;line-height:1.6;">
<p>${r.name} 様</p>
<p>${event.title} のリマインダーです。</p>
<p><strong>■ 予約内容</strong><br>
日付: ${event.date}<br>
時間: ${r.startTime} - ${r.endTime}<br>
${event.location ? `場所: ${event.location}<br>` : ""}人数: ${r.partySize}名${
        additionalNames.length > 0
          ? `<br>参加者:<br>${allNames.map((n, i) => `&nbsp;&nbsp;${i + 1}. ${n}`).join("<br>")}`
          : ""
      }</p>
<p><strong>■ 予約の詳細・キャンセル</strong><br>
<a href="${cancelUrl}">${cancelUrl}</a></p>
<p><strong>■ お時間を変更したい場合</strong><br>
お手数ですが、<a href="${reserveUrl}">新しい時間で予約</a>をお取りいただいた後、上記URLから現在の予約をキャンセルしてください。</p>
${
  r.partySize > 1
    ? `<p style="color:#666;font-size:13px;">※ 人数の一部変更をご希望の場合は、<a href="mailto:${adminEmail || ""}">${adminEmail || "管理者"}</a> までご連絡ください。</p>`
    : ""
}
<p>ご来場をお待ちしております。</p>
</div>`;

      await sendMail({
        to: r.email,
        subject: `【リマインダー】${event.title}`,
        html,
        text,
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
