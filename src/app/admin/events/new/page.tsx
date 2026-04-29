"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface TimeSlotInput {
  title: string;
  startTime: string;
  endTime: string;
  capacity: number;
}

export default function NewEventPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [timeSlots, setTimeSlots] = useState<TimeSlotInput[]>([
    { title: "", startTime: "18:00", endTime: "18:30", capacity: 10 },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const addSlot = () => {
    const last = timeSlots[timeSlots.length - 1];
    setTimeSlots([
      ...timeSlots,
      {
        title: "",
        startTime: last?.endTime || "18:00",
        endTime: "",
        capacity: last?.capacity || 10,
      },
    ]);
  };

  const removeSlot = (index: number) => {
    setTimeSlots(timeSlots.filter((_, i) => i !== index));
  };

  const updateSlot = (
    index: number,
    field: keyof TimeSlotInput,
    value: string | number
  ) => {
    setTimeSlots(
      timeSlots.map((slot, i) =>
        i === index ? { ...slot, [field]: value } : slot
      )
    );
  };

  const generateSlots = () => {
    const startHour = 18;
    const endHour = 21;
    const interval = 30; // minutes
    const capacity = 10;
    const slots: TimeSlotInput[] = [];

    for (let h = startHour; h < endHour; h++) {
      for (let m = 0; m < 60; m += interval) {
        const start = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        const endMinutes = m + interval;
        const endH = h + Math.floor(endMinutes / 60);
        const endM = endMinutes % 60;
        const end = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
        slots.push({ title: "", startTime: start, endTime: end, capacity });
      }
    }
    setTimeSlots(slots);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, date, location, timeSlots }),
      });

      if (!res.ok) {
        setError("イベントの作成に失敗しました");
        return;
      }

      const event = (await res.json()) as { id: string };
      router.push(`/admin/events/${event.id}`);
    } catch {
      setError("イベントの作成に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">イベント作成</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-xl bg-white p-6 shadow space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              タイトル <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="オープニングパーティ"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              説明
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={8}
              placeholder="イベントの説明を入力..."
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-sm"
            />
            <div className="mt-1 text-xs text-gray-400 space-y-0.5">
              <p>Markdown記法が使えます:</p>
              <p>画像: <code className="bg-gray-100 px-1 rounded">![説明](画像URL)</code></p>
              <p>リンク: <code className="bg-gray-100 px-1 rounded">[テキスト](URL)</code></p>
              <p>太字: <code className="bg-gray-100 px-1 rounded">**太字**</code>　見出し: <code className="bg-gray-100 px-1 rounded">## 見出し</code></p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                日付 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                場所
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="会場名・住所"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Time Slots */}
        <div className="rounded-xl bg-white p-6 shadow">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">時間帯設定</h2>
            <button
              type="button"
              onClick={generateSlots}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              18:00-21:00 / 30分刻みで自動生成
            </button>
          </div>

          <div className="space-y-3">
            {timeSlots.map((slot, index) => (
              <div key={index} className="flex items-center gap-3">
                <input
                  type="text"
                  value={slot.title}
                  onChange={(e) =>
                    updateSlot(index, "title", e.target.value)
                  }
                  placeholder="タイトル（任意）"
                  className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <input
                  type="time"
                  value={slot.startTime}
                  onChange={(e) =>
                    updateSlot(index, "startTime", e.target.value)
                  }
                  className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-gray-400">-</span>
                <input
                  type="time"
                  value={slot.endTime}
                  onChange={(e) =>
                    updateSlot(index, "endTime", e.target.value)
                  }
                  className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={1}
                    value={slot.capacity}
                    onChange={(e) =>
                      updateSlot(index, "capacity", Number(e.target.value))
                    }
                    className="w-20 rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-500">名</span>
                </div>
                {timeSlots.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeSlot(index)}
                    className="text-red-400 hover:text-red-600 p-1"
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
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addSlot}
            className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            + 時間帯を追加
          </button>
        </div>

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
          {submitting ? "作成中..." : "イベントを作成"}
        </button>
      </form>
    </div>
  );
}
