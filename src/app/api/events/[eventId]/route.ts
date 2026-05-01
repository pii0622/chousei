import { NextResponse } from "next/server";
import { eq, asc } from "drizzle-orm";
import { getDb } from "@/db";
import { events, timeSlots, reservations } from "@/db/schema";
import { requireEventOwner } from "@/lib/api-auth";

// GET single event with reservations (public - no auth required for reservation page)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const db = await getDb();
  const { eventId } = await params;

  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
    with: {
      adminUser: true,
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

// PUT update event (auth + ownership required)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const auth = await requireEventOwner(eventId);
  if ("error" in auth) return auth.error;

  const db = await getDb();
  const body = (await request.json()) as {
    title: string;
    description?: string;
    date: string;
    location?: string;
    timeSlots?: { title?: string; startTime: string; endTime: string; capacity: number }[];
  };

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
        title: slot.title || null,
        startTime: slot.startTime,
        endTime: slot.endTime,
        capacity: slot.capacity,
        sortOrder: index,
      }))
    );
  }

  return NextResponse.json({ ok: true });
}

// PATCH update event metadata (auth + ownership required)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const auth = await requireEventOwner(eventId);
  if ("error" in auth) return auth.error;

  const db = await getDb();
  const body = (await request.json()) as {
    title?: string;
    description?: string;
    location?: string;
  };

  const updates: Record<string, string> = {
    updatedAt: new Date().toISOString(),
  };
  if (typeof body.title === "string") {
    if (!body.title.trim()) {
      return NextResponse.json(
        { error: "タイトルは空にできません" },
        { status: 400 }
      );
    }
    updates.title = body.title;
  }
  if (typeof body.description === "string")
    updates.description = body.description;
  if (typeof body.location === "string") updates.location = body.location;

  await db.update(events).set(updates).where(eq(events.id, eventId));

  return NextResponse.json({ ok: true });
}

// DELETE event (auth + ownership required)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const auth = await requireEventOwner(eventId);
  if ("error" in auth) return auth.error;

  const db = await getDb();
  await db.delete(events).where(eq(events.id, eventId));
  return NextResponse.json({ ok: true });
}
