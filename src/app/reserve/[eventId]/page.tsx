"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import MarkdownContent from "@/components/MarkdownContent";

interface Reservation {
  id: string;
  name: string;
  email: string;
  partySize: number;
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

export default function ReservePage() {
  const params = useParams();
  const eventId = params.eventId as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [partySize, setPartySize] = useState(1);
  const [additionalNames, setAdditionalNames] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState("");
  const [reservedSlot, setReservedSlot] = useState<TimeSlot | null>(null);
  const [reservationId, setReservationId] = useState<string | null>(null);

  // Keep additionalNames array length in sync with partySize
  useEffect(() => {
    setAdditionalNames((prev) => {
      const needed = Math.max(0, partySize - 1);
      if (prev.length === needed) return prev;
      if (prev.length < needed) {
        return [...prev, ...Array(needed - prev.length).fill("")];
      }
      return prev.slice(0, needed);
    });
  }, [partySize]);

  useEffect(() => {
    fetch(`/api/events/${eventId}`)
      .then((r) => r.json() as Promise<Event & { error?: string }>)
      .then((data) => {
        if (data.error) {
          setError("イベントが見つかりません");
        } else {
          setEvent(data);
        }
      })
      .catch(() => setError("読み込みに失敗しました"))
      .finally(() => setLoading(false));
  }, [eventId]);

  const getRemaining = (slot: TimeSlot) => {
    const used = slot.reservations.reduce((sum, r) => sum + r.partySize, 0);
    return slot.capacity - used;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) return;
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timeSlotId: selectedSlot,
          name,
          email,
          partySize,
          additionalNames,
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error || "予約に失敗しました");
        return;
      }

      const data = (await res.json()) as { id: string };
      setReservationId(data.id);
      const slot = event?.timeSlots.find((s) => s.id === selectedSlot) || null;
      setReservedSlot(slot);
      setCompleted(true);
    } catch {
      setError("予約に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  const googleCalendarUrl = () => {
    if (!event || !reservedSlot) return "#";
    const dateClean = event.date.replace(/-/g, "");
    const startClean = reservedSlot.startTime.replace(/:/g, "") + "00";
    const endClean = reservedSlot.endTime.replace(/:/g, "") + "00";
    const url = new URL("https://calendar.google.com/calendar/render");
    url.searchParams.set("action", "TEMPLATE");
    url.searchParams.set("text", event.title);
    url.searchParams.set(
      "dates",
      `${dateClean}T${startClean}/${dateClean}T${endClean}`
    );
    url.searchParams.set("details", event.description);
    url.searchParams.set("location", event.location);
    return url.toString();
  };

  const downloadICS = () => {
    if (!event || !reservedSlot) return;
    const dateClean = event.date.replace(/-/g, "");
    const startClean = reservedSlot.startTime.replace(/:/g, "") + "00";
    const endClean = reservedSlot.endTime.replace(/:/g, "") + "00";
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Chousei//Event//JP",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `DTSTART:${dateClean}T${startClean}`,
      `DTEND:${dateClean}T${endClean}`,
      `SUMMARY:${event.title}`,
      `DESCRIPTION:${event.description.replace(/\n/g, "\\n")}`,
      `LOCATION:${event.location}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const blob = new Blob([ics], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "event.ics";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg text-gray-500">読み込み中...</div>
      </div>
    );
  }

  if (error && !event) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg text-red-500">{error}</div>
      </div>
    );
  }

  if (!event) return null;

  // Completion screen
  if (completed) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <div className="rounded-2xl bg-white p-8 shadow-lg text-center">
          <div className="mb-4 text-5xl">&#10003;</div>
          <h1 className="text-2xl font-bold text-green-600 mb-4">
            予約が完了しました
          </h1>
          <div className="mb-6 text-left space-y-2 bg-gray-50 rounded-lg p-4">
            <p>
              <span className="font-semibold">イベント:</span> {event.title}
            </p>
            <p>
              <span className="font-semibold">日付:</span> {event.date}
            </p>
            {reservedSlot && (
              <p>
                <span className="font-semibold">時間:</span>{" "}
                {reservedSlot.startTime} - {reservedSlot.endTime}
              </p>
            )}
            <p>
              <span className="font-semibold">お名前:</span> {name}
            </p>
            <p>
              <span className="font-semibold">人数:</span> {partySize}名
            </p>
          </div>
          <p className="text-sm text-gray-500 mb-6">
            確認メールをお送りしました
          </p>
          <div className="flex flex-col gap-3">
            {reservationId && (
              <a
                href={`/reserve/cancel/${reservationId}`}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-800 px-6 py-3 text-white font-medium hover:bg-gray-900 transition"
              >
                予約の詳細・キャンセルはこちら
              </a>
            )}
            <a
              href={googleCalendarUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-500 px-6 py-3 text-white font-medium hover:bg-blue-600 transition"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              Googleカレンダーに追加
            </a>
            <button
              onClick={downloadICS}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-500 px-6 py-3 text-white font-medium hover:bg-green-600 transition"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              カレンダーファイル(.ics)をダウンロード
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <div className="rounded-2xl bg-white p-6 shadow-lg">
        {/* Event Info */}
        <h1 className="text-2xl font-bold mb-1">{event.title}</h1>
        <div className="flex flex-wrap gap-4 mb-4 text-sm text-gray-700">
          <span className="inline-flex items-center gap-1 bg-gray-100 px-3 py-1 rounded-full">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            {event.date}
          </span>
          {event.location && (
            <span className="inline-flex items-center gap-1 bg-gray-100 px-3 py-1 rounded-full">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              {event.location}
            </span>
          )}
        </div>
        {event.description && (
          <div className="mb-6">
            <MarkdownContent content={event.description} />
          </div>
        )}

        {/* Time Slots */}
        <h2 className="text-lg font-semibold mb-3">時間帯を選択</h2>
        <div className="space-y-2 mb-6">
          {event.timeSlots.map((slot) => {
            const remaining = getRemaining(slot);
            const isFull = remaining <= 0;
            const isSelected = selectedSlot === slot.id;
            return (
              <button
                key={slot.id}
                onClick={() => {
                  if (!isFull) {
                    setSelectedSlot(slot.id);
                    setPartySize(1);
                  }
                }}
                disabled={isFull}
                className={`w-full flex items-center justify-between rounded-lg border-2 p-4 transition
                  ${
                    isFull
                      ? "border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed"
                      : isSelected
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-blue-300 hover:bg-blue-50/50"
                  }
                `}
              >
                <span className="font-medium">
                  {slot.startTime} - {slot.endTime}
                </span>
                <span
                  className={`text-sm px-3 py-1 rounded-full ${
                    isFull
                      ? "bg-red-100 text-red-500"
                      : remaining <= 3
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-green-100 text-green-700"
                  }`}
                >
                  {isFull
                    ? "満席"
                    : `残り ${remaining}/${slot.capacity} 席`}
                </span>
              </button>
            );
          })}
        </div>

        {/* Reservation Form */}
        {selectedSlot && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="border-t pt-4">
              <h2 className="text-lg font-semibold mb-3">予約情報を入力</h2>
            </div>

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
                placeholder="taro@example.com"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                人数
              </label>
              <select
                value={partySize}
                onChange={(e) => setPartySize(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {Array.from(
                  {
                    length: Math.min(
                      10,
                      getRemaining(
                        event.timeSlots.find((s) => s.id === selectedSlot)!
                      )
                    ),
                  },
                  (_, i) => i + 1
                ).map((n) => (
                  <option key={n} value={n}>
                    {n}名
                  </option>
                ))}
              </select>
            </div>

            {partySize > 1 && (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">
                  同伴者のお名前 <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-gray-500 -mt-1">
                  代表者以外の方のお名前をご記入ください
                </p>
                {additionalNames.map((n, i) => (
                  <input
                    key={i}
                    type="text"
                    required
                    value={n}
                    onChange={(e) => {
                      const next = [...additionalNames];
                      next[i] = e.target.value;
                      setAdditionalNames(next);
                    }}
                    placeholder={`同伴者 ${i + 1} のお名前`}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                ))}
              </div>
            )}

            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-blue-600 px-6 py-3 text-white font-medium hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {submitting ? "予約中..." : "予約する"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
