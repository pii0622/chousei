"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface TimeSlot {
  id: string;
  startTime: string;
  endTime: string;
  capacity: number;
  reservations: { partySize: number }[];
}

interface Event {
  id: string;
  title: string;
  date: string;
  location: string;
  timeSlots: TimeSlot[];
}

export default function AdminPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/events")
      .then((r) => r.json())
      .then(setEvents)
      .finally(() => setLoading(false));
  }, []);

  const getTotalReservations = (event: Event) => {
    return event.timeSlots.reduce(
      (sum, slot) =>
        sum + slot.reservations.reduce((s, r) => s + r.partySize, 0),
      0
    );
  };

  const getTotalCapacity = (event: Event) => {
    return event.timeSlots.reduce((sum, slot) => sum + slot.capacity, 0);
  };

  if (loading) {
    return <div className="text-gray-500">読み込み中...</div>;
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-semibold text-gray-600 mb-4">
          イベントがありません
        </h2>
        <Link
          href="/admin/events/new"
          className="inline-block rounded-lg bg-blue-600 px-6 py-3 text-white font-medium hover:bg-blue-700 transition"
        >
          最初のイベントを作成
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">イベント一覧</h1>
      <div className="space-y-4">
        {events.map((event) => (
          <Link
            key={event.id}
            href={`/admin/events/${event.id}`}
            className="block rounded-xl bg-white p-6 shadow hover:shadow-md transition"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">{event.title}</h2>
                <div className="mt-1 flex items-center gap-3 text-sm text-gray-500">
                  <span>{event.date}</span>
                  {event.location && <span>{event.location}</span>}
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-600">
                  {getTotalReservations(event)}
                  <span className="text-sm font-normal text-gray-400">
                    /{getTotalCapacity(event)}
                  </span>
                </div>
                <div className="text-xs text-gray-400">予約人数</div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {event.timeSlots.map((slot) => {
                const used = slot.reservations.reduce(
                  (s, r) => s + r.partySize,
                  0
                );
                const pct = (used / slot.capacity) * 100;
                return (
                  <span
                    key={slot.id}
                    className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600"
                  >
                    {slot.startTime}-{slot.endTime} ({used}/{slot.capacity}
                    {pct >= 100 ? " 満席" : ""})
                  </span>
                );
              })}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
