import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { reservations } from "@/db/schema";
import { generateICS } from "@/lib/calendar";

// GET .ics calendar file for a reservation
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ reservationId: string }> }
) {
  const db = await getDb();
  const { reservationId } = await params;

  const reservation = await db.query.reservations.findFirst({
    where: eq(reservations.id, reservationId),
    with: {
      timeSlot: {
        with: { event: true },
      },
    },
  });

  if (!reservation) {
    return NextResponse.json(
      { error: "Reservation not found" },
      { status: 404 }
    );
  }

  const event = reservation.timeSlot.event;
  const slot = reservation.timeSlot;

  const ics = generateICS({
    title: event.title,
    description: event.description,
    location: event.location,
    date: event.date,
    startTime: slot.startTime,
    endTime: slot.endTime,
  });

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="event.ics"`,
    },
  });
}
