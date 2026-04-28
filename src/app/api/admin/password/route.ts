import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { adminUsers } from "@/db/schema";
import { getSession, verifyPassword, hashPassword } from "@/lib/auth";

// PUT change password
export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { currentPassword, newPassword } = (await request.json()) as {
    currentPassword?: string;
    newPassword?: string;
  };

  if (!currentPassword || !newPassword) {
    return NextResponse.json(
      { error: "現在のパスワードと新しいパスワードを入力してください" },
      { status: 400 }
    );
  }

  if (newPassword.length < 6) {
    return NextResponse.json(
      { error: "パスワードは6文字以上にしてください" },
      { status: 400 }
    );
  }

  const db = await getDb();
  const user = await db.query.adminUsers.findFirst({
    where: eq(adminUsers.id, session.id),
  });

  if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
    return NextResponse.json(
      { error: "現在のパスワードが正しくありません" },
      { status: 401 }
    );
  }

  const newHash = await hashPassword(newPassword);
  await db
    .update(adminUsers)
    .set({ passwordHash: newHash })
    .where(eq(adminUsers.id, session.id));

  return NextResponse.json({ ok: true });
}
