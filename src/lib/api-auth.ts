import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { events } from "@/db/schema";
import { getSession, type SessionUser } from "@/lib/auth";

export async function requireAuth(): Promise<
  { session: SessionUser } | { error: NextResponse }
> {
  const session = await getSession();
  if (!session) {
    return { error: NextResponse.json({ error: "認証が必要です" }, { status: 401 }) };
  }
  return { session };
}

export async function requireEventOwner(eventId: string): Promise<
  { session: SessionUser } | { error: NextResponse }
> {
  const auth = await requireAuth();
  if ("error" in auth) return auth;

  const { session } = auth;
  if (session.role === "super_admin") return { session };

  const db = await getDb();
  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
  });

  if (!event) {
    return { error: NextResponse.json({ error: "イベントが見つかりません" }, { status: 404 }) };
  }

  if (event.adminUserId !== session.id) {
    return { error: NextResponse.json({ error: "権限がありません" }, { status: 403 }) };
  }

  return { session };
}

export async function requireSuperAdmin(): Promise<
  { session: SessionUser } | { error: NextResponse }
> {
  const auth = await requireAuth();
  if ("error" in auth) return auth;

  if (auth.session.role !== "super_admin") {
    return { error: NextResponse.json({ error: "権限がありません" }, { status: 403 }) };
  }

  return auth;
}
