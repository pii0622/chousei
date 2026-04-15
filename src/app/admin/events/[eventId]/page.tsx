"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import QRCode from "qrcode";

interface Reservation {
  id: string;
  name: string;
  email: string;
  partySize: number;
  createdAt: string;
}

interface TimeSlot {
  id: string;
  startTime: string;
  endTime: string;
  capacity: number;
  reservations: Reservation[];
}

interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  location: string;
  timeSlots: TimeSlot[];
}

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [reminderResult, setReminderResult] = useState("");
  const [copiedEmails, setCopiedEmails] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  const appUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const reserveUrl = `${appUrl}/reserve/${eventId}`;

  useEffect(() => {
    fetch(`/api/events/${eventId}`)
      .then((r) => r.json() as Promise<Event & { error?: string }>)
      .then((data) => {
        if (!data.error) setEvent(data);
      })
      .finally(() => setLoading(false));
  }, [eventId]);

  useEffect(() => {
    if (qrCanvasRef.current && event) {
      QRCode.toCanvas(qrCanvasRef.current, reserveUrl, {
        width: 200,
        margin: 2,
      });
    }
  }, [event, reserveUrl]);

  const handleDelete = async () => {
    if (!confirm("このイベントを削除しますか？")) return;
    setDeleting(true);
    await fetch(`/api/events/${eventId}`, { method: "DELETE" });
    router.push("/admin");
  };

  const handleSendReminder = async () => {
    if (!confirm("全予約者にリマインダーメールを送信しますか？")) return;
    setSendingReminder(true);
    setReminderResult("");
    try {
      const res = await fetch(`/api/admin/events/${eventId}/reminders`, {
        method: "POST",
      });
      const data = (await res.json()) as { sent: number; failed: number; total: number };
      setReminderResult(
        `送信完了: ${data.sent}件成功 / ${data.failed}件失敗 (合計${data.total}件)`
      );
    } catch {
      setReminderResult("送信に失敗しました");
    } finally {
      setSendingReminder(false);
    }
  };

  const handleCopyEmails = async () => {
    const res = await fetch(
      `/api/admin/events/${eventId}/export?format=emails`
    );
    const text = await res.text();
    await navigator.clipboard.writeText(text);
    setCopiedEmails(true);
    setTimeout(() => setCopiedEmails(false), 2000);
  };

  const handleDownloadCSV = () => {
    window.open(`/api/admin/events/${eventId}/export?format=csv`, "_blank");
  };

  const handleDeleteReservation = async (reservationId: string, name: string) => {
    if (!confirm(`${name} さんの予約を削除しますか？`)) return;
    const res = await fetch(`/api/reservations/${reservationId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      alert("削除に失敗しました");
      return;
    }
    // Refresh event data
    const refreshed = await fetch(`/api/events/${eventId}`).then(
      (r) => r.json() as Promise<Event & { error?: string }>
    );
    if (!refreshed.error) setEvent(refreshed);
  };

  if (loading) {
    return <div className="text-gray-500">読み込み中...</div>;
  }

  if (!event) {
    return <div className="text-red-500">イベントが見つかりません</div>;
  }

  const totalReserved = event.timeSlots.reduce(
    (sum, slot) =>
      sum + slot.reservations.reduce((s, r) => s + r.partySize, 0),
    0
  );
  const totalCapacity = event.timeSlots.reduce(
    (sum, slot) => sum + slot.capacity,
    0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{event.title}</h1>
          <div className="mt-1 flex items-center gap-3 text-sm text-gray-500">
            <span>{event.date}</span>
            {event.location && <span>{event.location}</span>}
          </div>
          {event.description && (
            <p className="mt-2 text-gray-600 whitespace-pre-wrap">
              {event.description}
            </p>
          )}
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-blue-600">
            {totalReserved}
            <span className="text-lg font-normal text-gray-400">
              /{totalCapacity}
            </span>
          </div>
          <div className="text-sm text-gray-400">総予約人数</div>
        </div>
      </div>

      {/* QR Code + Reservation URL */}
      <div className="rounded-xl bg-white p-6 shadow">
        <h2 className="text-lg font-semibold mb-4">予約URL / QRコード</h2>
        <div className="flex flex-col sm:flex-row items-start gap-6">
          <canvas ref={qrCanvasRef} className="rounded-lg" />
          <div className="flex-1 space-y-3">
            <div>
              <label className="block text-sm text-gray-500 mb-1">
                予約ページURL
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={reserveUrl}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm bg-gray-50"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(reserveUrl);
                  }}
                  className="rounded-lg bg-gray-100 px-4 py-2 text-sm hover:bg-gray-200 transition"
                >
                  コピー
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-400">
              このURLまたはQRコードを招待者に共有してください
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="rounded-xl bg-white p-6 shadow">
        <h2 className="text-lg font-semibold mb-4">アクション</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleSendReminder}
            disabled={sendingReminder}
            className="rounded-lg bg-yellow-500 px-4 py-2 text-sm text-white font-medium hover:bg-yellow-600 disabled:opacity-50 transition"
          >
            {sendingReminder ? "送信中..." : "リマインダーメール送信"}
          </button>
          <button
            onClick={handleCopyEmails}
            className="rounded-lg bg-purple-500 px-4 py-2 text-sm text-white font-medium hover:bg-purple-600 transition"
          >
            {copiedEmails ? "コピーしました!" : "メールアドレス一覧をコピー"}
          </button>
          <button
            onClick={handleDownloadCSV}
            className="rounded-lg bg-green-500 px-4 py-2 text-sm text-white font-medium hover:bg-green-600 transition"
          >
            CSVダウンロード
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-lg bg-red-500 px-4 py-2 text-sm text-white font-medium hover:bg-red-600 disabled:opacity-50 transition"
          >
            イベント削除
          </button>
        </div>
        {reminderResult && (
          <p className="mt-3 text-sm text-gray-600">{reminderResult}</p>
        )}
      </div>

      {/* Reservations by Time Slot */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">時間帯別予約一覧</h2>
        {event.timeSlots.map((slot) => {
          const used = slot.reservations.reduce(
            (s, r) => s + r.partySize,
            0
          );
          const remaining = slot.capacity - used;
          return (
            <div key={slot.id} className="rounded-xl bg-white p-6 shadow">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">
                  {slot.startTime} - {slot.endTime}
                </h3>
                <span
                  className={`text-sm px-3 py-1 rounded-full ${
                    remaining <= 0
                      ? "bg-red-100 text-red-600"
                      : remaining <= 3
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-green-100 text-green-700"
                  }`}
                >
                  {used}/{slot.capacity}名
                  {remaining <= 0 ? " (満席)" : ` (残り${remaining}名)`}
                </span>
              </div>
              {slot.reservations.length === 0 ? (
                <p className="text-sm text-gray-400">予約なし</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-gray-500">
                        <th className="pb-2 pr-4">名前</th>
                        <th className="pb-2 pr-4">メール</th>
                        <th className="pb-2 pr-4">人数</th>
                        <th className="pb-2 pr-4">予約日時</th>
                        <th className="pb-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {slot.reservations.map((r) => (
                        <tr key={r.id} className="border-b last:border-0">
                          <td className="py-2 pr-4">{r.name}</td>
                          <td className="py-2 pr-4 text-gray-500">
                            {r.email}
                          </td>
                          <td className="py-2 pr-4">{r.partySize}名</td>
                          <td className="py-2 pr-4 text-gray-400">
                            {new Date(r.createdAt).toLocaleString("ja-JP")}
                          </td>
                          <td className="py-2 text-right">
                            <button
                              onClick={() => handleDeleteReservation(r.id, r.name)}
                              className="text-xs text-red-500 hover:text-red-700 hover:underline"
                            >
                              削除
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
