import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { adminUsers, events, timeSlots, reservations } from "@/db/schema";
import { getSession } from "@/lib/auth";

// GET list all admin accounts (super_admin only)
export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = await getDb();
  const users = await db
    .select({
      id: adminUsers.id,
      email: adminUsers.email,
      name: adminUsers.name,
      role: adminUsers.role,
      createdAt: adminUsers.createdAt,
    })
    .from(adminUsers)
    .orderBy(adminUsers.createdAt);

  return NextResponse.json(users);
}

// DELETE an admin account and all their events (super_admin only)
export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const userId = url.searchParams.get("id");
  if (!userId) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  if (userId === session.id) {
    return NextResponse.json(
      { error: "自分自身を削除することはできません" },
      { status: 400 }
    );
  }

  const db = await getDb();

  // Cascade: delete user → events → timeSlots → reservations
  // SQLite foreign key cascade handles timeSlots → reservations,
  // but Event → AdminUser cascade needs events deleted first
  // since Event.adminUserId is nullable (not cascade by default in data)
  const userEvents = await db
    .select({ id: events.id })
    .from(events)
    .where(eq(events.adminUserId, userId));

  for (const event of userEvents) {
    await db.delete(timeSlots).where(eq(timeSlots.eventId, event.id));
    await db.delete(events).where(eq(events.id, event.id));
  }

  await db.delete(adminUsers).where(eq(adminUsers.id, userId));

  return NextResponse.json({ ok: true });
}
