import { NextResponse } from "next/server";
import { eq, asc } from "drizzle-orm";
import { getDb } from "@/db";
import { events, timeSlots, reservations } from "@/db/schema";

// GET single event with reservations
export async function GET(
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
        with: {
          reservations: { orderBy: asc(reservations.createdAt) },
        },
      },
    },
  });

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  return NextResponse.json(event);
}

// PUT update event
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const db = await getDb();
  const { eventId } = await params;
  const body = (await request.json()) as {
    title: string;
    description?: string;
    date: string;
    location?: string;
    timeSlots?: { startTime: string; endTime: string; capacity: number }[];
  };

  // Delete existing time slots and recreate
  await db.delete(timeSlots).where(eq(timeSlots.eventId, eventId));

  await db
    .update(events)
    .set({
      title: body.title,
      description: body.description || "",
      date: body.date,
      location: body.location || "",
      updatedAt: new Date().toISOString(),
    })
    .where(eq(events.id, eventId));

  if (body.timeSlots && body.timeSlots.length > 0) {
    await db.insert(timeSlots).values(
      body.timeSlots.map((slot, index) => ({
        id: crypto.randomUUID(),
        eventId,
        startTime: slot.startTime,
        endTime: slot.endTime,
        capacity: slot.capacity,
        sortOrder: index,
      }))
    );
  }

  return NextResponse.json({ ok: true });
}

// DELETE event
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const db = await getDb();
  const { eventId } = await params;
  await db.delete(events).where(eq(events.id, eventId));
  return NextResponse.json({ ok: true });
}
