import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail";

// POST send reminder emails to all reservations for an event
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const prisma = await getPrisma();
  const { eventId } = await params;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      timeSlots: {
        orderBy: { sortOrder: "asc" },
        include: { reservations: true },
      },
    },
  });

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

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
      await sendMail({
        to: r.email,
        subject: `【リマインダー】${event.title}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>${event.title} のリマインダー</h2>
            <p>${r.name} 様</p>
            <p>ご予約のリマインダーをお送りいたします。</p>
            <table style="border-collapse: collapse; width: 100%;">
              <tr><td style="padding: 8px; font-weight: bold;">日付</td><td style="padding: 8px;">${event.date}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold;">時間</td><td style="padding: 8px;">${r.startTime} - ${r.endTime}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold;">人数</td><td style="padding: 8px;">${r.partySize}名</td></tr>
              ${event.location ? `<tr><td style="padding: 8px; font-weight: bold;">場所</td><td style="padding: 8px;">${event.location}</td></tr>` : ""}
            </table>
            <p style="margin-top: 20px; color: #666;">ご来場をお待ちしております。</p>
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
