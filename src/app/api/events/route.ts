import { NextResponse } from "next/server";
import { desc, asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { events, timeSlots } from "@/db/schema";
import { getSession } from "@/lib/auth";

// GET events (filtered by admin, or all for super_admin)
export async function GET() {
  const session = await getSession();
  const db = await getDb();

  const allEvents = await db.query.events.findMany({
    with: {
      timeSlots: {
        orderBy: asc(timeSlots.sortOrder),
        with: { reservations: true },
      },
      adminUser: true,
    },
    ...(session && session.role !== "super_admin"
      ? { where: eq(events.adminUserId, session.id) }
      : {}),
    orderBy: desc(events.date),
  });

  return NextResponse.json(allEvents);
}

// POST create event (must be logged in)
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

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
    adminUserId: session.id,
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
