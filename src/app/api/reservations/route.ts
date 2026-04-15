import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/db";
import { timeSlots, reservations } from "@/db/schema";
import { sendMail } from "@/lib/mail";

// POST create reservation
export async function POST(request: Request) {
  const db = await getDb();
  const body = (await request.json()) as {
    timeSlotId?: string;
    name?: string;
    email?: string;
    partySize?: number;
    additionalNames?: string[];
  };
  const {
    timeSlotId,
    name,
    email,
    partySize = 1,
    additionalNames = [],
  } = body;

  if (!timeSlotId || !name || !email) {
    return NextResponse.json(
      { error: "timeSlotId, name, email are required" },
      { status: 400 }
    );
  }

  if (partySize < 1) {
    return NextResponse.json(
      { error: "partySize must be at least 1" },
      { status: 400 }
    );
  }

  // Validate additional names count matches partySize - 1
  if (partySize > 1) {
    if (additionalNames.length !== partySize - 1) {
      return NextResponse.json(
        { error: "追加の人数分の名前を全て入力してください" },
        { status: 400 }
      );
    }
    if (additionalNames.some((n) => !n || !n.trim())) {
      return NextResponse.json(
        { error: "同伴者の名前を入力してください" },
        { status: 400 }
      );
    }
  }

  // Get timeslot with current reservations and event
  const timeSlot = await db.query.timeSlots.findFirst({
    where: eq(timeSlots.id, timeSlotId),
    with: { reservations: true, event: true },
  });

  if (!timeSlot) {
    return NextResponse.json(
      { error: "Time slot not found" },
      { status: 404 }
    );
  }

  // Check capacity
  const currentTotal = timeSlot.reservations.reduce(
    (sum, r) => sum + r.partySize,
    0
  );
  const remaining = timeSlot.capacity - currentTotal;

  if (partySize > remaining) {
    return NextResponse.json(
      { error: `Insufficient capacity. Remaining: ${remaining}` },
      { status: 409 }
    );
  }

  // Check duplicate
  const existing = await db.query.reservations.findFirst({
    where: and(
      eq(reservations.timeSlotId, timeSlotId),
      eq(reservations.email, email)
    ),
  });

  if (existing) {
    return NextResponse.json(
      { error: "You have already reserved this time slot" },
      { status: 409 }
    );
  }

  const reservationId = crypto.randomUUID();
  await db.insert(reservations).values({
    id: reservationId,
    timeSlotId,
    name,
    email,
    partySize,
    additionalNames:
      additionalNames.length > 0 ? JSON.stringify(additionalNames) : null,
  });

  const event = timeSlot.event;
  const slot = timeSlot;

  const { env, ctx } = await getCloudflareContext({ async: true });
  const envMap = env as Record<string, string | undefined>;
  const appUrl = envMap.NEXT_PUBLIC_APP_URL || "";
  const adminEmail = envMap.ADMIN_EMAIL;
  const cancelUrl = `${appUrl}/reserve/cancel/${reservationId}`;
  const adminEventUrl = `${appUrl}/admin/events/${event.id}`;

  const allNames = [name, ...additionalNames];
  const participantsText = allNames
    .map((n, i) => `  ${i + 1}. ${n}`)
    .join("\n");

  // Guest confirmation email - simple HTML + plain text
  // (Calendar links are available on the cancellation/confirmation page
  //  to keep the email body minimal and avoid spam filters like Yahoo's.)
  const guestText = `${name} 様

${event.title} のご予約を承りました。

■ 予約内容
日付: ${event.date}
時間: ${slot.startTime} - ${slot.endTime}
${event.location ? `場所: ${event.location}\n` : ""}人数: ${partySize}名${
    additionalNames.length > 0 ? `\n参加者:\n${participantsText}` : ""
  }

■ 予約の詳細・キャンセル・時間変更
${cancelUrl}

時間を変更したい場合や、内容の確認・キャンセルは上記URLからお願いします。
${
  partySize > 1
    ? `\n※ 人数の一部変更をご希望の場合は、${adminEmail || "管理者"} までご連絡ください。`
    : ""
}

ご来場をお待ちしております。`;

  const guestHtml = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#333;line-height:1.6;">
<p>${name} 様</p>
<p>${event.title} のご予約を承りました。</p>
<p><strong>■ 予約内容</strong><br>
日付: ${event.date}<br>
時間: ${slot.startTime} - ${slot.endTime}<br>
${event.location ? `場所: ${event.location}<br>` : ""}人数: ${partySize}名${
    additionalNames.length > 0
      ? `<br>参加者:<br>${allNames.map((n, i) => `&nbsp;&nbsp;${i + 1}. ${n}`).join("<br>")}`
      : ""
  }</p>
<p><strong>■ 予約の詳細・キャンセル・時間変更</strong><br>
<a href="${cancelUrl}">${cancelUrl}</a><br>
<span style="color:#666;font-size:13px;">時間を変更したい場合や、内容の確認・キャンセルは上記URLからお願いします。</span></p>
${
  partySize > 1
    ? `<p style="color:#666;font-size:13px;">※ 人数の一部変更をご希望の場合は、<a href="mailto:${adminEmail || ""}">${adminEmail || "管理者"}</a> までご連絡ください。</p>`
    : ""
}
<p>ご来場をお待ちしております。</p>
</div>`;

  ctx.waitUntil(
    sendMail({
      to: email,
      subject: `【予約確認】${event.title}`,
      html: guestHtml,
      text: guestText,
    }).catch((err) => console.error("[Mail] Failed to send confirmation:", err))
  );

  // Admin notification
  if (adminEmail) {
    const newTotal = currentTotal + partySize;
    const adminText = `新しい予約が入りました。

■ イベント: ${event.title}
日付: ${event.date}
時間: ${slot.startTime} - ${slot.endTime}
代表者: ${name}
メール: ${email}
人数: ${partySize}名${
      additionalNames.length > 0 ? `\n参加者:\n${participantsText}` : ""
    }
現在の予約: ${newTotal}/${slot.capacity}名

管理画面: ${adminEventUrl}`;

    const adminHtml = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#333;line-height:1.6;">
<p>新しい予約が入りました。</p>
<p><strong>■ イベント: ${event.title}</strong><br>
日付: ${event.date}<br>
時間: ${slot.startTime} - ${slot.endTime}<br>
代表者: ${name}<br>
メール: ${email}<br>
人数: ${partySize}名${
      additionalNames.length > 0
        ? `<br>参加者:<br>${allNames.map((n, i) => `&nbsp;&nbsp;${i + 1}. ${n}`).join("<br>")}`
        : ""
    }<br>
現在の予約: ${newTotal}/${slot.capacity}名</p>
<p>管理画面: <a href="${adminEventUrl}">${adminEventUrl}</a></p>
</div>`;

    ctx.waitUntil(
      sendMail({
        to: adminEmail,
        subject: `【新規予約】${event.title} - ${name}様`,
        html: adminHtml,
        text: adminText,
      }).catch((err) =>
        console.error("[Mail] Failed to send admin notification:", err)
      )
    );
  }

  return NextResponse.json({ id: reservationId }, { status: 201 });
}
