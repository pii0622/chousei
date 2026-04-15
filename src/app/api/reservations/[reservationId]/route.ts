import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { reservations } from "@/db/schema";

// GET reservation details (for cancel confirmation page)
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

  return NextResponse.json(reservation);
}

// DELETE reservation
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ reservationId: string }> }
) {
  const db = await getDb();
  const { reservationId } = await params;

  const existing = await db.query.reservations.findFirst({
    where: eq(reservations.id, reservationId),
  });

  if (!existing) {
    return NextResponse.json(
      { error: "Reservation not found" },
      { status: 404 }
    );
  }

  await db.delete(reservations).where(eq(reservations.id, reservationId));

  return NextResponse.json({ ok: true });
}
