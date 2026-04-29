import { NextResponse } from "next/server";
import { eq, asc } from "drizzle-orm";
import { getDb } from "@/db";
import { timeSlots } from "@/db/schema";

// POST add a new time slot
export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const db = await getDb();
  const { eventId } = await params;
  const body = (await request.json()) as {
    title?: string;
    startTime: string;
    endTime: string;
    capacity: number;
  };

  if (!body.startTime || !body.endTime || !body.capacity) {
    return NextResponse.json(
      { error: "startTime, endTime, capacity are required" },
      { status: 400 }
    );
  }

  // Get current max sortOrder
  const existing = await db
    .select()
    .from(timeSlots)
    .where(eq(timeSlots.eventId, eventId))
    .orderBy(asc(timeSlots.sortOrder));

  const maxSort =
    existing.length > 0 ? existing[existing.length - 1].sortOrder : -1;

  const id = crypto.randomUUID();
  await db.insert(timeSlots).values({
    id,
    eventId,
    title: body.title || null,
    startTime: body.startTime,
    endTime: body.endTime,
    capacity: body.capacity,
    sortOrder: maxSort + 1,
  });

  return NextResponse.json({ id }, { status: 201 });
}

// PUT reorder time slots
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const db = await getDb();
  const { eventId } = await params;
  const body = (await request.json()) as { slotIds: string[] };

  if (!body.slotIds || !Array.isArray(body.slotIds)) {
    return NextResponse.json(
      { error: "slotIds array is required" },
      { status: 400 }
    );
  }

  // Verify all slots belong to this event
  const existing = await db
    .select()
    .from(timeSlots)
    .where(eq(timeSlots.eventId, eventId));

  const existingIds = new Set(existing.map((s) => s.id));
  for (const id of body.slotIds) {
    if (!existingIds.has(id)) {
      return NextResponse.json(
        { error: `Slot ${id} does not belong to this event` },
        { status: 400 }
      );
    }
  }

  // Update sortOrder for each slot
  for (let i = 0; i < body.slotIds.length; i++) {
    await db
      .update(timeSlots)
      .set({ sortOrder: i })
      .where(eq(timeSlots.id, body.slotIds[i]));
  }

  return NextResponse.json({ ok: true });
}

// DELETE a time slot (only if no reservations)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const db = await getDb();
  const { eventId } = await params;
  const url = new URL(request.url);
  const slotId = url.searchParams.get("slotId");

  if (!slotId) {
    return NextResponse.json(
      { error: "slotId query parameter is required" },
      { status: 400 }
    );
  }

  const slot = await db.query.timeSlots.findFirst({
    where: eq(timeSlots.id, slotId),
    with: { reservations: true },
  });

  if (!slot || slot.eventId !== eventId) {
    return NextResponse.json(
      { error: "Time slot not found" },
      { status: 404 }
    );
  }

  if (slot.reservations.length > 0) {
    return NextResponse.json(
      { error: "予約が入っている時間帯は削除できません" },
      { status: 409 }
    );
  }

  await db.delete(timeSlots).where(eq(timeSlots.id, slotId));

  return NextResponse.json({ ok: true });
}
