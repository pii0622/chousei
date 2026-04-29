import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { adminInvites, adminUsers } from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { requestSenderVerification } from "@/lib/mail";

// GET validate invite token
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  const db = await getDb();
  const invite = await db.query.adminInvites.findFirst({
    where: eq(adminInvites.id, token),
  });

  if (!invite) {
    return NextResponse.json(
      { error: "無効な招待URLです" },
      { status: 404 }
    );
  }

  if (invite.used) {
    return NextResponse.json(
      { error: "この招待URLは既に使用されています" },
      { status: 410 }
    );
  }

  if (new Date(invite.expiresAt) < new Date()) {
    return NextResponse.json(
      { error: "この招待URLは有効期限が切れています" },
      { status: 410 }
    );
  }

  return NextResponse.json({ valid: true });
}

// POST register new admin account
export async function POST(request: Request) {
  const body = (await request.json()) as {
    token?: string;
    name?: string;
    email?: string;
    password?: string;
  };

  if (!body.token || !body.name || !body.email || !body.password) {
    return NextResponse.json(
      { error: "全ての項目を入力してください" },
      { status: 400 }
    );
  }

  if (body.password.length < 6) {
    return NextResponse.json(
      { error: "パスワードは6文字以上にしてください" },
      { status: 400 }
    );
  }

  const db = await getDb();

  // Validate invite
  const invite = await db.query.adminInvites.findFirst({
    where: eq(adminInvites.id, body.token),
  });

  if (!invite || invite.used || new Date(invite.expiresAt) < new Date()) {
    return NextResponse.json(
      { error: "無効または期限切れの招待URLです" },
      { status: 400 }
    );
  }

  // Check email uniqueness
  const existingUser = await db.query.adminUsers.findFirst({
    where: eq(adminUsers.email, body.email),
  });

  if (existingUser) {
    return NextResponse.json(
      { error: "このメールアドレスは既に登録されています" },
      { status: 409 }
    );
  }

  // Create account
  const passwordHash = await hashPassword(body.password);
  await db.insert(adminUsers).values({
    id: crypto.randomUUID(),
    email: body.email,
    passwordHash,
    name: body.name,
    role: "admin",
  });

  // Mark invite as used
  await db
    .update(adminInvites)
    .set({ used: true })
    .where(eq(adminInvites.id, body.token));

  // Auto-trigger SendGrid sender verification
  requestSenderVerification(body.email, body.name).catch((err) =>
    console.error("[Mail] Failed to request sender verification:", err)
  );

  return NextResponse.json({ ok: true }, { status: 201 });
}
