"use client";

import { useState, useEffect, createContext, useContext } from "react";
import Link from "next/link";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

const AuthContext = createContext<{
  user: User | null;
  setUser: (u: User | null) => void;
}>({ user: null, setUser: () => {} });

export function useAuth() {
  return useContext(AuthContext);
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);
  const [emailVerified, setEmailVerified] = useState<boolean | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState("");

  const checkEmailVerification = () => {
    fetch("/api/admin/verify-email")
      .then((r) => (r.ok ? (r.json() as Promise<{ verified: boolean }>) : null))
      .then((data) => {
        if (data) setEmailVerified(data.verified);
      });
  };

  useEffect(() => {
    fetch("/api/admin/auth")
      .then((r) => {
        if (r.ok) return r.json() as Promise<{ user: User }>;
        return null;
      })
      .then((data) => {
        if (data?.user) {
          setUser(data.user);
          // Check email verification after auth
          checkEmailVerification();
        }
      })
      .finally(() => setChecking(false));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/admin/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      user?: User;
      error?: string;
    };
    if (res.ok && data.user) {
      setUser(data.user);
      checkEmailVerification();
    } else {
      setError(data.error || "ログインに失敗しました");
    }
  };

  const handleRequestVerification = async () => {
    setVerifying(true);
    setVerifyMessage("");
    try {
      const res = await fetch("/api/admin/verify-email", { method: "POST" });
      const data = (await res.json()) as {
        verified?: boolean;
        message?: string;
        error?: string;
      };
      if (data.verified) {
        setEmailVerified(true);
        setVerifyMessage("認証済みです");
      } else if (data.message) {
        setVerifyMessage(data.message);
      } else if (data.error) {
        setVerifyMessage(`エラー: ${data.error}`);
      }
    } catch {
      setVerifyMessage("認証リクエストに失敗しました");
    } finally {
      setVerifying(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/admin/auth", { method: "DELETE" });
    setUser(null);
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg"
        >
          <h1 className="text-xl font-bold mb-6 text-center">管理者ログイン</h1>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="メールアドレス"
            required
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 mb-3 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="パスワード"
            required
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 mb-4 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
          <button
            type="submit"
            className="w-full rounded-lg bg-blue-600 px-6 py-2.5 text-white font-medium hover:bg-blue-700 transition"
          >
            ログイン
          </button>
        </form>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, setUser }}>
      <div className="min-h-screen">
        <nav className="bg-white border-b shadow-sm">
          <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
            <Link href="/admin" className="text-lg font-bold text-blue-600">
              Chousei 管理画面
            </Link>
            <div className="flex items-center gap-4">
              {user.role === "super_admin" && (
                <Link
                  href="/admin/accounts"
                  className="text-sm text-gray-600 hover:text-gray-800"
                >
                  アカウント管理
                </Link>
              )}
              <Link
                href="/admin/events/new"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white font-medium hover:bg-blue-700 transition"
              >
                + イベント作成
              </Link>
              <span className="text-sm text-gray-500">{user.name}</span>
              <button
                onClick={handleLogout}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                ログアウト
              </button>
            </div>
          </div>
        </nav>
        {emailVerified === false && (
          <div className="bg-yellow-50 border-b border-yellow-200">
            <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
              {user.role === "super_admin" ? (
                <>
                  <div className="text-sm text-yellow-800">
                    <strong>メール認証が必要です:</strong>{" "}
                    SendGridダッシュボードで送信元メールを認証してください。
                    {verifyMessage && (
                      <span className="ml-2 text-yellow-600">{verifyMessage}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleRequestVerification}
                      disabled={verifying}
                      className="rounded bg-yellow-600 px-3 py-1 text-xs text-white font-medium hover:bg-yellow-700 disabled:opacity-50"
                    >
                      {verifying ? "送信中..." : "SendGridに認証リクエスト"}
                    </button>
                    <button
                      onClick={checkEmailVerification}
                      className="rounded bg-yellow-100 px-3 py-1 text-xs text-yellow-700 hover:bg-yellow-200"
                    >
                      状態を更新
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-sm text-yellow-800">
                    <strong>メール認証中:</strong>{" "}
                    現在アプリ管理者がメールアドレスの認証を行っています。認証が完了するまで、予約確認メールは送信されません。
                  </div>
                  <button
                    onClick={checkEmailVerification}
                    className="rounded bg-yellow-100 px-3 py-1 text-xs text-yellow-700 hover:bg-yellow-200"
                  >
                    状態を更新
                  </button>
                </>
              )}
            </div>
          </div>
        )}
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      </div>
    </AuthContext.Provider>
  );
}
