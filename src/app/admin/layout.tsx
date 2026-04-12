"use client";

import { useState, useEffect, createContext, useContext } from "react";
import Link from "next/link";

const AuthContext = createContext<{
  authenticated: boolean;
  setAuthenticated: (v: boolean) => void;
}>({ authenticated: false, setAuthenticated: () => {} });

export function useAuth() {
  return useContext(AuthContext);
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const saved = sessionStorage.getItem("admin_auth");
    if (saved === "true") {
      setAuthenticated(true);
    }
    setChecking(false);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/admin/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      setAuthenticated(true);
      sessionStorage.setItem("admin_auth", "true");
    } else {
      setError("パスワードが正しくありません");
    }
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg"
        >
          <h1 className="text-xl font-bold mb-6 text-center">管理者ログイン</h1>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="パスワード"
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 mb-4 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {error && (
            <p className="text-red-500 text-sm mb-4">{error}</p>
          )}
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
    <AuthContext.Provider value={{ authenticated, setAuthenticated }}>
      <div className="min-h-screen">
        <nav className="bg-white border-b shadow-sm">
          <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
            <Link href="/admin" className="text-lg font-bold text-blue-600">
              Chousei 管理画面
            </Link>
            <div className="flex items-center gap-4">
              <Link
                href="/admin/events/new"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white font-medium hover:bg-blue-700 transition"
              >
                + イベント作成
              </Link>
              <button
                onClick={() => {
                  sessionStorage.removeItem("admin_auth");
                  setAuthenticated(false);
                }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                ログアウト
              </button>
            </div>
          </div>
        </nav>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      </div>
    </AuthContext.Provider>
  );
}
