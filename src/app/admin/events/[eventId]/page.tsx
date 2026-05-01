"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";
import MarkdownContent from "@/components/MarkdownContent";

interface Reservation {
  id: string;
  name: string;
  email: string;
  partySize: number;
  additionalNames: string | null;
  createdAt: string;
}

interface TimeSlot {
  id: string;
  title: string | null;
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
  multiSlotEnabled: boolean;
  timeSlots: TimeSlot[];
}

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [copiedEmails, setCopiedEmails] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editMultiSlot, setEditMultiSlot] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [addingSlot, setAddingSlot] = useState(false);
  const [viewMode, setViewMode] = useState<"timeslot" | "participant">("timeslot");
  const [newSlotTitle, setNewSlotTitle] = useState("");
  const [newSlotStart, setNewSlotStart] = useState("11:00");
  const [newSlotEnd, setNewSlotEnd] = useState("12:00");
  const [newSlotCapacity, setNewSlotCapacity] = useState(10);
  const [savingSlot, setSavingSlot] = useState(false);
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

  const startEdit = () => {
    if (!event) return;
    setEditTitle(event.title);
    setEditDescription(event.description);
    setEditLocation(event.location);
    setEditMultiSlot(event.multiSlotEnabled);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
  };

  const saveEdit = async () => {
    if (!editTitle.trim()) {
      alert("タイトルを入力してください");
      return;
    }
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle,
          description: editDescription,
          location: editLocation,
          multiSlotEnabled: editMultiSlot,
        }),
      });
      if (!res.ok) {
        alert("保存に失敗しました");
        return;
      }
      const refreshed = await fetch(`/api/events/${eventId}`).then(
        (r) => r.json() as Promise<Event & { error?: string }>
      );
      if (!refreshed.error) setEvent(refreshed);
      setEditing(false);
    } catch {
      alert("保存に失敗しました");
    } finally {
      setSavingEdit(false);
    }
  };

  const refreshEvent = async () => {
    const data = await fetch(`/api/events/${eventId}`).then(
      (r) => r.json() as Promise<Event & { error?: string }>
    );
    if (!data.error) setEvent(data);
  };

  const handleAddSlot = async () => {
    if (!newSlotStart || !newSlotEnd) return;
    setSavingSlot(true);
    try {
      const res = await fetch(`/api/events/${eventId}/timeslots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newSlotTitle || undefined,
          startTime: newSlotStart,
          endTime: newSlotEnd,
          capacity: newSlotCapacity,
        }),
      });
      if (!res.ok) {
        alert("追加に失敗しました");
        return;
      }
      await refreshEvent();
      setAddingSlot(false);
    } catch {
      alert("追加に失敗しました");
    } finally {
      setSavingSlot(false);
    }
  };

  const handleMoveSlot = async (index: number, direction: "up" | "down") => {
    if (!event) return;
    const slots = [...event.timeSlots];
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= slots.length) return;
    [slots[index], slots[target]] = [slots[target], slots[index]];
    const slotIds = slots.map((s) => s.id);
    await fetch(`/api/events/${eventId}/timeslots`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slotIds }),
    });
    await refreshEvent();
  };

  const handleDeleteSlot = async (slotId: string, label: string, hasReservations: boolean) => {
    if (hasReservations) {
      alert("予約が入っている時間帯は削除できません");
      return;
    }
    if (!confirm(`${label} を削除しますか？`)) return;
    const res = await fetch(
      `/api/events/${eventId}/timeslots?slotId=${slotId}`,
      { method: "DELETE" }
    );
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      alert(data.error || "削除に失敗しました");
      return;
    }
    await refreshEvent();
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
    await refreshEvent();
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
      {editing ? (
        <div className="rounded-xl bg-white p-6 shadow space-y-4">
          <h2 className="text-lg font-semibold">イベント情報を編集</h2>
          <p className="text-xs text-gray-500">
            ※ 日付と時間帯は変更できません（既存の予約に影響するため）
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              タイトル <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              説明
            </label>
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={8}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-sm"
            />
            <div className="mt-1 text-xs text-gray-400 space-y-0.5">
              <p>Markdown記法が使えます:</p>
              <p>画像: <code className="bg-gray-100 px-1 rounded">![説明](画像URL)</code></p>
              <p>リンク: <code className="bg-gray-100 px-1 rounded">[テキスト](URL)</code></p>
              <p>太字: <code className="bg-gray-100 px-1 rounded">**太字**</code>　見出し: <code className="bg-gray-100 px-1 rounded">## 見出し</code></p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              場所
            </label>
            <input
              type="text"
              value={editLocation}
              onChange={(e) => setEditLocation(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={editMultiSlot}
                onChange={(e) => setEditMultiSlot(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">
                予約者が複数の時間帯を選択できるようにする
              </span>
            </label>
          </div>
          <div className="flex gap-2">
            <button
              onClick={saveEdit}
              disabled={savingEdit}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white font-medium hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {savingEdit ? "保存中..." : "保存"}
            </button>
            <button
              onClick={cancelEdit}
              className="rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-700 font-medium hover:bg-gray-200 transition"
            >
              キャンセル
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{event.title}</h1>
              <button
                onClick={startEdit}
                className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
              >
                編集
              </button>
            </div>
            <div className="mt-1 flex items-center gap-3 text-sm text-gray-500">
              <span>{event.date}</span>
              {event.location && <span>{event.location}</span>}
            </div>
            {event.description && (
              <div className="mt-2">
                <MarkdownContent content={event.description} />
              </div>
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
      )}

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
          <Link
            href={`/admin/events/${eventId}/email`}
            className="rounded-lg bg-blue-500 px-4 py-2 text-sm text-white font-medium hover:bg-blue-600 transition"
          >
            一括メール送信
          </Link>
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
      </div>

      {/* View Toggle */}
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={() => setViewMode("timeslot")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            viewMode === "timeslot"
              ? "bg-gray-800 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          時間帯別
        </button>
        <button
          onClick={() => setViewMode("participant")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            viewMode === "participant"
              ? "bg-gray-800 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          参加者別
        </button>
      </div>

      {/* Participant View */}
      {viewMode === "participant" && (
        <div className="rounded-xl bg-white p-6 shadow">
          <h2 className="text-lg font-semibold mb-4">参加者別一覧</h2>
          {(() => {
            const participantMap = new Map<
              string,
              {
                name: string;
                email: string;
                slots: { startTime: string; endTime: string; title: string | null; partySize: number; additionalNames: string | null; reservationId: string }[];
              }
            >();
            event.timeSlots.forEach((slot) => {
              slot.reservations.forEach((r) => {
                const key = r.email;
                if (!participantMap.has(key)) {
                  participantMap.set(key, { name: r.name, email: r.email, slots: [] });
                }
                participantMap.get(key)!.slots.push({
                  startTime: slot.startTime,
                  endTime: slot.endTime,
                  title: slot.title,
                  partySize: r.partySize,
                  additionalNames: r.additionalNames,
                  reservationId: r.id,
                });
              });
            });

            const participants = Array.from(participantMap.values());

            if (participants.length === 0) {
              return <p className="text-sm text-gray-400">予約者はまだいません</p>;
            }

            return (
              <div className="space-y-3">
                {participants.map((p) => (
                  <div key={p.email} className="rounded-lg border p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className="font-semibold">{p.name}</span>
                        <span className="ml-2 text-sm text-gray-500">{p.email}</span>
                      </div>
                      <span className="text-sm text-gray-500">{p.slots.length}枠</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {p.slots.map((s) => {
                        const extras: string[] = s.additionalNames
                          ? (JSON.parse(s.additionalNames) as string[])
                          : [];
                        return (
                          <div
                            key={s.reservationId}
                            className="text-xs bg-blue-50 text-blue-800 px-3 py-1.5 rounded-lg"
                          >
                            <div className="font-medium">
                              {s.title && <span>{s.title} </span>}
                              {s.startTime}-{s.endTime}
                            </div>
                            <div className="text-blue-600">
                              {s.partySize}名
                              {extras.length > 0 && (
                                <span className="ml-1">({extras.join(", ")})</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* Time Slot View */}
      {viewMode === "timeslot" && (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">時間帯別予約一覧</h2>
          <button
            onClick={() => setAddingSlot(!addingSlot)}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            {addingSlot ? "閉じる" : "+ 時間帯を追加"}
          </button>
        </div>

        {addingSlot && (
          <div className="rounded-xl bg-white p-4 shadow space-y-3">
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={newSlotTitle}
                onChange={(e) => setNewSlotTitle(e.target.value)}
                placeholder="タイトル（任意）"
                className="w-40 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <input
                type="time"
                value={newSlotStart}
                onChange={(e) => setNewSlotStart(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-gray-400">-</span>
              <input
                type="time"
                value={newSlotEnd}
                onChange={(e) => setNewSlotEnd(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={1}
                  value={newSlotCapacity}
                  onChange={(e) => setNewSlotCapacity(Number(e.target.value))}
                  className="w-20 rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-500">名</span>
              </div>
              <button
                onClick={handleAddSlot}
                disabled={savingSlot}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white font-medium hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {savingSlot ? "追加中..." : "追加"}
              </button>
            </div>
          </div>
        )}

        {event.timeSlots.map((slot, slotIndex) => {
          const used = slot.reservations.reduce(
            (s, r) => s + r.partySize,
            0
          );
          const remaining = slot.capacity - used;
          const hasReservations = slot.reservations.length > 0;
          return (
            <div key={slot.id} className="rounded-xl bg-white p-6 shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    defaultValue={slot.title || ""}
                    placeholder="タイトルを入力"
                    className="text-blue-600 font-semibold bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none px-0 py-0.5"
                    onBlur={async (e) => {
                      const newTitle = e.target.value.trim();
                      if (newTitle === (slot.title || "")) return;
                      await fetch(`/api/events/${eventId}/timeslots`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          slotId: slot.id,
                          title: newTitle || null,
                        }),
                      });
                      await refreshEvent();
                    }}
                  />
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleMoveSlot(slotIndex, "up")}
                      disabled={slotIndex === 0}
                      className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-30 px-1"
                      title="上に移動"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => handleMoveSlot(slotIndex, "down")}
                      disabled={slotIndex === event.timeSlots.length - 1}
                      className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-30 px-1"
                      title="下に移動"
                    >
                      ▼
                    </button>
                    <button
                      onClick={() =>
                        handleDeleteSlot(
                          slot.id,
                          `${slot.startTime}-${slot.endTime}`,
                          hasReservations
                        )
                      }
                      className={`text-xs px-1 ${
                        hasReservations
                          ? "text-gray-300 cursor-not-allowed"
                          : "text-red-400 hover:text-red-600"
                      }`}
                      title={
                        hasReservations
                          ? "予約ありのため削除不可"
                          : "この時間帯を削除"
                      }
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <div className="text-right shrink-0 flex items-center gap-2">
                  <input
                    type="time"
                    defaultValue={slot.startTime}
                    className="border border-transparent hover:border-gray-300 focus:border-blue-500 rounded px-1 py-0.5 text-sm text-gray-600 bg-transparent focus:outline-none w-20 text-right"
                    onBlur={async (e) => {
                      if (e.target.value === slot.startTime) return;
                      await fetch(`/api/events/${eventId}/timeslots`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ slotId: slot.id, startTime: e.target.value }),
                      });
                      await refreshEvent();
                    }}
                  />
                  <span className="text-gray-400 text-sm">-</span>
                  <input
                    type="time"
                    defaultValue={slot.endTime}
                    className="border border-transparent hover:border-gray-300 focus:border-blue-500 rounded px-1 py-0.5 text-sm text-gray-600 bg-transparent focus:outline-none w-20"
                    onBlur={async (e) => {
                      if (e.target.value === slot.endTime) return;
                      await fetch(`/api/events/${eventId}/timeslots`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ slotId: slot.id, endTime: e.target.value }),
                      });
                      await refreshEvent();
                    }}
                  />
                  <span className="text-gray-400 text-sm">/</span>
                  <div className="flex items-center gap-0.5">
                    <input
                      type="number"
                      min={1}
                      defaultValue={slot.capacity}
                      className="border border-transparent hover:border-gray-300 focus:border-blue-500 rounded px-1 py-0.5 text-sm bg-transparent focus:outline-none w-12 text-right"
                      onBlur={async (e) => {
                        const val = Number(e.target.value);
                        if (val === slot.capacity || val < 1) return;
                        await fetch(`/api/events/${eventId}/timeslots`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ slotId: slot.id, capacity: val }),
                        });
                        await refreshEvent();
                      }}
                    />
                    <span className="text-xs text-gray-500">名</span>
                  </div>
                  <span
                    className={`text-xs ml-1 ${
                      remaining <= 0
                        ? "text-red-600"
                        : remaining <= 3
                          ? "text-yellow-700"
                          : "text-green-700"
                    }`}
                  >
                    ({remaining <= 0 ? "満席" : `残${remaining}`})
                  </span>
                </div>
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
                      {slot.reservations.map((r) => {
                        const extras: string[] = r.additionalNames
                          ? (JSON.parse(r.additionalNames) as string[])
                          : [];
                        return (
                          <tr key={r.id} className="border-b last:border-0 align-top">
                            <td className="py-2 pr-4">
                              <div>{r.name}</div>
                              {extras.length > 0 && (
                                <div className="mt-1 text-xs text-gray-500">
                                  {extras.map((n, i) => (
                                    <div key={i}>+ {n}</div>
                                  ))}
                                </div>
                              )}
                            </td>
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
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}
