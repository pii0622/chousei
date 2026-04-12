import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail";
import { generateGoogleCalendarUrl, generateICS } from "@/lib/calendar";

// POST create reservation
export async function POST(request: Request) {
  const body = await request.json();
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

  // Get timeslot with current reservations
  const timeSlot = await prisma.timeSlot.findUnique({
    where: { id: timeSlotId },
    include: {
      reservations: true,
      event: true,
    },
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
  const existing = await prisma.reservation.findUnique({
    where: {
      timeSlotId_email: { timeSlotId, email },
    },
  });

  if (existing) {
    return NextResponse.json(
      { error: "You have already reserved this time slot" },
      { status: 409 }
    );
  }

  const reservation = await prisma.reservation.create({
    data: { timeSlotId, name, email, partySize },
    include: {
      timeSlot: {
        include: { event: true },
      },
    },
  });

  // Send confirmation email (async, don't block response)
  const event = reservation.timeSlot.event;
  const slot = reservation.timeSlot;

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

  const icsBase64 = Buffer.from(icsContent).toString("base64");

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
      </div>
    `,
  }).catch((err) => console.error("[Mail] Failed to send confirmation:", err));

  return NextResponse.json(reservation, { status: 201 });
}
