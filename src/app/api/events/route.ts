import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET all events
export async function GET() {
  const events = await prisma.event.findMany({
    include: {
      timeSlots: {
        orderBy: { sortOrder: "asc" },
        include: {
          reservations: true,
        },
      },
    },
    orderBy: { date: "desc" },
  });
  return NextResponse.json(events);
}

// POST create event
export async function POST(request: Request) {
  const body = await request.json();
  const { title, description, date, location, timeSlots } = body;

  const event = await prisma.event.create({
    data: {
      title,
      description: description || "",
      date,
      location: location || "",
      timeSlots: {
        create: (timeSlots || []).map(
          (
            slot: { startTime: string; endTime: string; capacity: number },
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

  return NextResponse.json(event, { status: 201 });
}
