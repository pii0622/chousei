import { NextResponse } from "next/server";
import { eq, asc } from "drizzle-orm";
import { getDb } from "@/db";
import { timeSlots } from "@/db/schema";
import { requireEventOwner } from "@/lib/api-auth";

// POST add a new time slot (auth + ownership required)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const auth = await requireEventOwner(eventId);
  if ("error" in auth) return auth.error;

  const db = await getDb();
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

// PUT reorder time slots (auth + ownership required)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const auth = await requireEventOwner(eventId);
  if ("error" in auth) return auth.error;

  const db = await getDb();
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

// PATCH update a time slot (auth + ownership required)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const auth = await requireEventOwner(eventId);
  if ("error" in auth) return auth.error;

  const db = await getDb();
  const body = (await request.json()) as {
    slotId: string;
    title?: string | null;
    startTime?: string;
    endTime?: string;
    capacity?: number;
  };

  if (!body.slotId) {
    return NextResponse.json({ error: "slotId is required" }, { status: 400 });
  }

  const slot = await db.query.timeSlots.findFirst({
    where: eq(timeSlots.id, body.slotId),
  });

  if (!slot || slot.eventId !== eventId) {
    return NextResponse.json({ error: "Time slot not found" }, { status: 404 });
  }

  const updates: Record<string, string | number | null> = {};
  if (body.title !== undefined) updates.title = body.title || null;
  if (body.startTime) updates.startTime = body.startTime;
  if (body.endTime) updates.endTime = body.endTime;
  if (body.capacity && body.capacity > 0) updates.capacity = body.capacity;

  if (Object.keys(updates).length > 0) {
    await db
      .update(timeSlots)
      .set(updates)
      .where(eq(timeSlots.id, body.slotId));
  }

  return NextResponse.json({ ok: true });
}

// DELETE a time slot (auth + ownership required, only if no reservations)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const auth = await requireEventOwner(eventId);
  if ("error" in auth) return auth.error;

  const db = await getDb();
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
