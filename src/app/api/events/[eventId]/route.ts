import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

// GET single event with reservations
export async function GET(
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
        include: {
          reservations: {
            orderBy: { createdAt: "asc" },
          },
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
  const prisma = await getPrisma();
  const { eventId } = await params;
  const body = (await request.json()) as {
    title: string;
    description?: string;
    date: string;
    location?: string;
    timeSlots?: { startTime: string; endTime: string; capacity: number }[];
  };
  const { title, description, date, location, timeSlots } = body;

  // Delete existing time slots and recreate
  await prisma.timeSlot.deleteMany({ where: { eventId } });

  const event = await prisma.event.update({
    where: { id: eventId },
    data: {
      title,
      description: description || "",
      date,
      location: location || "",
      timeSlots: {
        create: (timeSlots || []).map(
          (
            slot: {
              startTime: string;
              endTime: string;
              capacity: number;
            },
            index: number
          ) => ({
            startTime: slot.startTime,
            endTime: slot.endTime,
            capacity: slot.capacity,
            sortOrder: index,
          })
        ),
      },
    },
    include: {
      timeSlots: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  return NextResponse.json(event);
}

// DELETE event
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const prisma = await getPrisma();
  const { eventId } = await params;
  await prisma.event.delete({ where: { id: eventId } });
  return NextResponse.json({ ok: true });
}
