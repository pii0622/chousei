"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function RegisterPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [validating, setValidating] = useState(true);
  const [valid, setValid] = useState(false);
  const [invalidMessage, setInvalidMessage] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (!token) {
      setInvalidMessage("招待URLが無効です");
      setValidating(false);
      return;
    }
    fetch(`/api/admin/register?token=${token}`)
      .then((r) => r.json() as Promise<{ valid?: boolean; error?: string }>)
      .then((data) => {
        if (data.valid) {
          setValid(true);
        } else {
          setInvalidMessage(data.error || "無効な招待URLです");
        }
      })
      .catch(() => setInvalidMessage("検証に失敗しました"))
      .finally(() => setValidating(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("パスワードが一致しません");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name, email, password }),
      });

      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(data.error || "登録に失敗しました");
        return;
      }

      setCompleted(true);
    } catch {
      setError("登録に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  if (validating) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-gray-500">確認中...</div>
      </div>
    );
  }

  if (!valid && !completed) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg text-center">
          <p className="text-red-500">{invalidMessage}</p>
        </div>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg text-center">
          <div className="mb-4 text-5xl">&#10003;</div>
          <h1 className="text-xl font-bold text-green-600 mb-4">
            アカウント作成完了
          </h1>
          <p className="text-gray-600 mb-6">
            登録したメールアドレスとパスワードでログインしてください。
          </p>
          <button
            onClick={() => router.push("/admin")}
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-white font-medium hover:bg-blue-700 transition"
          >
            ログインページへ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg"
      >
        <h1 className="text-xl font-bold mb-6 text-center">
          管理アカウント登録
        </h1>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              お名前 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="山田 太郎"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              メールアドレス <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              パスワード <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="6文字以上"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              パスワード（確認） <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="もう一度入力"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {error && (
          <p className="text-red-500 text-sm mt-4">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full mt-6 rounded-lg bg-blue-600 px-6 py-2.5 text-white font-medium hover:bg-blue-700 disabled:opacity-50 transition"
        >
          {submitting ? "登録中..." : "アカウントを作成"}
        </button>
      </form>
    </div>
  );
}
