import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  isEmailVerified,
  requestSenderVerification,
} from "@/lib/mail";

// GET check verification status
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const verified = await isEmailVerified(session.email);
  return NextResponse.json({ email: session.email, verified });
}

// POST request verification (sends confirmation email from SendGrid)
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const already = await isEmailVerified(session.email);
  if (already) {
    return NextResponse.json({ email: session.email, verified: true });
  }

  const result = await requestSenderVerification(session.email, session.name);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error || "認証リクエストに失敗しました" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    email: session.email,
    verified: false,
    message: "確認メールを送信しました。メール内のリンクをクリックしてください。",
  });
}
