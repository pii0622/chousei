import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  isEmailVerified,
  requestSenderVerification,
  getVerifiedSenders,
} from "@/lib/mail";

// GET check verification status of current user
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const verified = await isEmailVerified(session.email);
  return NextResponse.json({ email: session.email, verified });
}

// POST request verification (super_admin only, can verify any email)
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Only super_admin can trigger verification
  if (session.role !== "super_admin") {
    return NextResponse.json(
      { error: "メール認証はアプリ管理者が行います。しばらくお待ちください。" },
      { status: 403 }
    );
  }

  const body = (await request.json()) as { email?: string; name?: string };
  const targetEmail = body.email || session.email;
  const targetName = body.name || session.name;

  const already = await isEmailVerified(targetEmail);
  if (already) {
    return NextResponse.json({ email: targetEmail, verified: true });
  }

  const result = await requestSenderVerification(targetEmail, targetName);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error || "認証リクエストに失敗しました" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    email: targetEmail,
    verified: false,
    message: "SendGridに認証リクエストを送信しました。SendGridダッシュボードで確認してください。",
  });
}
