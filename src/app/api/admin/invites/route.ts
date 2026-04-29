import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { adminInvites, adminUsers } from "@/db/schema";
import { getSession } from "@/lib/auth";

// GET list all invites (super_admin only)
export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = await getDb();
  const invites = await db.query.adminInvites.findMany({
    with: { creator: true },
    orderBy: (t, { desc }) => desc(t.createdAt),
  });

  return NextResponse.json(invites);
}

// POST create new invite (super_admin only)
export async function POST() {
  const session = await getSession();
  if (!session || session.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = await getDb();
  const id = crypto.randomUUID();
  const expiresAt = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  await db.insert(adminInvites).values({
    id,
    createdBy: session.id,
    expiresAt,
  });

  return NextResponse.json({ id, expiresAt }, { status: 201 });
}

// DELETE an invite (super_admin only)
export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const inviteId = url.searchParams.get("id");
  if (!inviteId) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const db = await getDb();
  await db.delete(adminInvites).where(eq(adminInvites.id, inviteId));

  return NextResponse.json({ ok: true });
}
