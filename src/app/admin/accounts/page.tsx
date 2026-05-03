"use client";

import { useEffect, useState } from "react";

interface AdminAccount {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  emailVerified?: boolean;
}

interface Invite {
  id: string;
  used: boolean;
  expiresAt: string;
  createdAt: string;
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchData = async () => {
    const [accountsRes, invitesRes] = await Promise.all([
      fetch("/api/admin/accounts"),
      fetch("/api/admin/invites"),
    ]);
    if (accountsRes.ok) {
      const accts = (await accountsRes.json()) as AdminAccount[];
      // Check verification status for each account
      const verifiedRes = await fetch("/api/admin/verify-email");
      let verifiedEmails: string[] = [];
      if (verifiedRes.ok) {
        // We need to check each email - use the verified senders list
        // For now, mark from the single check
      }
      setAccounts(accts);
    }
    if (invitesRes.ok)
      setInvites((await invitesRes.json()) as Invite[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleVerifyEmail = async (email: string, name: string) => {
    const res = await fetch("/api/admin/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name }),
    });
    const data = (await res.json()) as {
      verified?: boolean;
      message?: string;
      error?: string;
    };
    if (data.verified) {
      alert(`${email} は認証済みです`);
    } else if (data.message) {
      alert(data.message);
    } else if (data.error) {
      alert(`エラー: ${data.error}`);
    }
  };

  const handleCreateInvite = async () => {
    setCreating(true);
    const res = await fetch("/api/admin/invites", { method: "POST" });
    if (res.ok) {
      await fetchData();
    }
    setCreating(false);
  };

  const handleDeleteInvite = async (id: string) => {
    if (!confirm("この招待URLを削除しますか？")) return;
    await fetch(`/api/admin/invites?id=${id}`, { method: "DELETE" });
    await fetchData();
  };

  const handleDeleteAccount = async (id: string, name: string) => {
    if (
      !confirm(
        `${name} のアカウントとすべてのイベントを削除しますか？\nこの操作は取り消せません。`
      )
    )
      return;
    const res = await fetch(`/api/admin/accounts?id=${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      alert(data.error || "削除に失敗しました");
      return;
    }
    await fetchData();
  };

  const getInviteUrl = (id: string) => {
    const base =
      typeof window !== "undefined" ? window.location.origin : "";
    return `${base}/admin/register?token=${id}`;
  };

  const copyInviteUrl = async (id: string) => {
    await navigator.clipboard.writeText(getInviteUrl(id));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) {
    return <div className="text-gray-500">読み込み中...</div>;
  }

  const activeInvites = invites.filter(
    (i) => !i.used && new Date(i.expiresAt) > new Date()
  );
  const usedOrExpiredInvites = invites.filter(
    (i) => i.used || new Date(i.expiresAt) <= new Date()
  );

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">アカウント管理</h1>

      {/* Invite Section */}
      <div className="rounded-xl bg-white p-6 shadow">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">招待URL</h2>
          <button
            onClick={handleCreateInvite}
            disabled={creating}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white font-medium hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {creating ? "作成中..." : "+ 招待URLを発行"}
          </button>
        </div>

        {activeInvites.length === 0 ? (
          <p className="text-sm text-gray-400">
            有効な招待URLはありません
          </p>
        ) : (
          <div className="space-y-3">
            {activeInvites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center gap-3 rounded-lg bg-gray-50 p-3"
              >
                <input
                  type="text"
                  readOnly
                  value={getInviteUrl(invite.id)}
                  className="flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm bg-white"
                />
                <button
                  onClick={() => copyInviteUrl(invite.id)}
                  className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm hover:bg-gray-200 transition"
                >
                  {copiedId === invite.id ? "コピー済み!" : "コピー"}
                </button>
                <button
                  onClick={() => handleDeleteInvite(invite.id)}
                  className="text-sm text-red-500 hover:text-red-700"
                >
                  削除
                </button>
                <span className="text-xs text-gray-400">
                  期限:{" "}
                  {new Date(invite.expiresAt.endsWith("Z") ? invite.expiresAt : invite.expiresAt + "Z").toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })}
                </span>
              </div>
            ))}
          </div>
        )}

        {usedOrExpiredInvites.length > 0 && (
          <details className="mt-4">
            <summary className="text-sm text-gray-400 cursor-pointer">
              使用済み / 期限切れ ({usedOrExpiredInvites.length}件)
            </summary>
            <div className="mt-2 space-y-2">
              {usedOrExpiredInvites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center gap-3 text-sm text-gray-400"
                >
                  <span className="truncate flex-1">{invite.id}</span>
                  <span>
                    {invite.used
                      ? "使用済み"
                      : "期限切れ"}
                  </span>
                  <button
                    onClick={() => handleDeleteInvite(invite.id)}
                    className="text-red-400 hover:text-red-600"
                  >
                    削除
                  </button>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      {/* Accounts Section */}
      <div className="rounded-xl bg-white p-6 shadow">
        <h2 className="text-lg font-semibold mb-4">登録アカウント</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-2 pr-4">名前</th>
                <th className="pb-2 pr-4">メール</th>
                <th className="pb-2 pr-4">権限</th>
                <th className="pb-2 pr-4">登録日</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr
                  key={account.id}
                  className="border-b last:border-0 align-top"
                >
                  <td className="py-2 pr-4">{account.name}</td>
                  <td className="py-2 pr-4 text-gray-500">
                    {account.email}
                  </td>
                  <td className="py-2 pr-4">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        account.role === "super_admin"
                          ? "bg-purple-100 text-purple-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {account.role === "super_admin"
                        ? "アプリ管理者"
                        : "管理アカウント"}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-gray-400">
                    {new Date(account.createdAt.endsWith("Z") ? account.createdAt : account.createdAt + "Z").toLocaleDateString(
                      "ja-JP", { timeZone: "Asia/Tokyo" }
                    )}
                  </td>
                  <td className="py-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() =>
                          handleVerifyEmail(account.email, account.name)
                        }
                        className="text-xs text-blue-500 hover:text-blue-700 hover:underline"
                      >
                        メール認証
                      </button>
                      {account.role !== "super_admin" && (
                        <button
                          onClick={() =>
                            handleDeleteAccount(account.id, account.name)
                          }
                          className="text-xs text-red-500 hover:text-red-700 hover:underline"
                        >
                          削除
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
