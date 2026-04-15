import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/db";
import { timeSlots, reservations } from "@/db/schema";
import { sendMail } from "@/lib/mail";
import { generateGoogleCalendarUrl, generateICS } from "@/lib/calendar";

// POST create reservation
export async function POST(request: Request) {
  const db = await getDb();
  const body = (await request.json()) as {
    timeSlotId?: string;
    name?: string;
    email?: string;
    partySize?: number;
  };
  const { timeSlotId, name, email, partySize = 1 } = body;

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
  });

  // Send confirmation email (async, don't block response)
  const event = timeSlot.event;
  const slot = timeSlot;

  const googleCalUrl = generateGoogleCalendarUrl({
    title: event.title,
    description: event.description,
    location: event.location,
    date: event.date,
    startTime: slot.startTime,
    endTime: slot.endTime,
  });

  const icsContent = generateICS({
    title: event.title,
    description: event.description,
    location: event.location,
    date: event.date,
    startTime: slot.startTime,
    endTime: slot.endTime,
  });

  const icsBase64 = btoa(icsContent);

  const { env, ctx } = await getCloudflareContext({ async: true });
  const envMap = env as Record<string, string | undefined>;
  const appUrl = envMap.NEXT_PUBLIC_APP_URL || "";
  const adminEmail = envMap.ADMIN_EMAIL;
  const cancelUrl = `${appUrl}/reserve/cancel/${reservationId}`;
  const adminEventUrl = `${appUrl}/admin/events/${event.id}`;

  // Send confirmation email to guest (use waitUntil so the Worker doesn't
  // terminate before the email is sent)
  ctx.waitUntil(
    sendMail({
      to: email,
      subject: `【予約確認】${event.title}`,
      html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>予約が確定しました</h2>
        <table style="border-collapse: collapse; width: 100%;">
          <tr><td style="padding: 8px; font-weight: bold;">イベント</td><td style="padding: 8px;">${event.title}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">日付</td><td style="padding: 8px;">${event.date}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">時間</td><td style="padding: 8px;">${slot.startTime} - ${slot.endTime}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">お名前</td><td style="padding: 8px;">${name}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">人数</td><td style="padding: 8px;">${partySize}名</td></tr>
          ${event.location ? `<tr><td style="padding: 8px; font-weight: bold;">場所</td><td style="padding: 8px;">${event.location}</td></tr>` : ""}
        </table>
        <div style="margin-top: 20px;">
          <a href="${googleCalUrl}" target="_blank"
             style="display: inline-block; padding: 10px 20px; background: #4285f4; color: white; text-decoration: none; border-radius: 4px;">
            Googleカレンダーに追加
          </a>
        </div>
        <div style="margin-top: 10px;">
          <a href="data:text/calendar;base64,${icsBase64}" download="event.ics"
             style="display: inline-block; padding: 10px 20px; background: #34a853; color: white; text-decoration: none; border-radius: 4px;">
            カレンダーファイル(.ics)をダウンロード
          </a>
        </div>
        <p style="margin-top: 20px; color: #666; font-size: 14px;">
          ご来場をお待ちしております。
        </p>
        <hr style="margin: 30px 0; border: 0; border-top: 1px solid #eee;" />
        <p style="color: #999; font-size: 12px;">
          ご都合が悪くなった場合は、以下のリンクから予約をキャンセルできます：<br />
          <a href="${cancelUrl}" style="color: #666;">${cancelUrl}</a>
        </p>
      </div>
    `,
    }).catch((err) => console.error("[Mail] Failed to send confirmation:", err))
  );

  // Send notification email to admin
  if (adminEmail) {
    const newTotal = currentTotal + partySize;
    ctx.waitUntil(
      sendMail({
        to: adminEmail,
        subject: `【新規予約】${event.title} - ${name}様`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>新しい予約が入りました</h2>
            <table style="border-collapse: collapse; width: 100%;">
              <tr><td style="padding: 8px; font-weight: bold;">イベント</td><td style="padding: 8px;">${event.title}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold;">日付</td><td style="padding: 8px;">${event.date}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold;">時間</td><td style="padding: 8px;">${slot.startTime} - ${slot.endTime}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold;">お名前</td><td style="padding: 8px;">${name}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold;">メール</td><td style="padding: 8px;">${email}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold;">人数</td><td style="padding: 8px;">${partySize}名</td></tr>
              <tr><td style="padding: 8px; font-weight: bold;">現在の予約状況</td><td style="padding: 8px;">${newTotal}/${slot.capacity}名</td></tr>
            </table>
            <div style="margin-top: 20px;">
              <a href="${adminEventUrl}" target="_blank"
                 style="display: inline-block; padding: 10px 20px; background: #3b82f6; color: white; text-decoration: none; border-radius: 4px;">
                管理画面で確認
              </a>
            </div>
          </div>
        `,
      }).catch((err) => console.error("[Mail] Failed to send admin notification:", err))
    );
  }

  return NextResponse.json({ id: reservationId }, { status: 201 });
}
