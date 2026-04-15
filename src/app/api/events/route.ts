import { NextResponse } from "next/server";
import { desc, asc } from "drizzle-orm";
import { getDb } from "@/db";
import { events, timeSlots } from "@/db/schema";

// GET all events with timeSlots and reservations
export async function GET() {
  const db = await getDb();
  const allEvents = await db.query.events.findMany({
    with: {
      timeSlots: {
        orderBy: asc(timeSlots.sortOrder),
        with: { reservations: true },
      },
    },
    orderBy: desc(events.date),
  });

  return NextResponse.json(allEvents);
}

// POST create event
export async function POST(request: Request) {
  const db = await getDb();
  const body = (await request.json()) as {
    title: string;
    description?: string;
    date: string;
    location?: string;
    timeSlots?: { startTime: string; endTime: string; capacity: number }[];
  };

  const eventId = crypto.randomUUID();
  await db.insert(events).values({
    id: eventId,
    title: body.title,
    description: body.description || "",
    date: body.date,
    location: body.location || "",
  });

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

  return NextResponse.json({ id: eventId }, { status: 201 });
}
