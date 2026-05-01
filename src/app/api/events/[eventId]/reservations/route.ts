import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/db";
import { reservations, timeSlots } from "@/db/schema";

// GET reservations by email for an event
export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const url = new URL(request.url);
  const email = url.searchParams.get("email");

  if (!email) {
    return NextResponse.json({ error: "email required" }, { status: 400 });
  }

  const db = await getDb();

  // Get all time slots for this event
  const eventSlots = await db.query.timeSlots.findMany({
    where: eq(timeSlots.eventId, eventId),
    with: {
      reservations: {
        where: eq(reservations.email, email),
      },
    },
    orderBy: (t, { asc }) => asc(t.sortOrder),
  });

  // Filter to only slots that have reservations from this email
  const userReservations = eventSlots
    .filter((slot) => slot.reservations.length > 0)
    .map((slot) => ({
      reservationId: slot.reservations[0].id,
      name: slot.reservations[0].name,
      email: slot.reservations[0].email,
      partySize: slot.reservations[0].partySize,
      additionalNames: slot.reservations[0].additionalNames,
      createdAt: slot.reservations[0].createdAt,
      timeSlot: {
        id: slot.id,
        title: slot.title,
        startTime: slot.startTime,
        endTime: slot.endTime,
      },
    }));

  return NextResponse.json(userReservations);
}
