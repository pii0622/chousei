"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface Reservation {
  id: string;
  name: string;
  email: string;
  partySize: number;
  timeSlot: {
    startTime: string;
    endTime: string;
    event: {
      title: string;
      date: string;
      location: string;
    };
  };
}

export default function CancelPage() {
  const params = useParams();
  const reservationId = params.reservationId as string;

  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => {
    fetch(`/api/reservations/${reservationId}`)
      .then(
        (r) => r.json() as Promise<Reservation & { error?: string }>
      )
      .then((data) => {
        if (data.error) {
          setError("予約が見つかりません。既にキャンセル済みか、URLが正しくありません。");
        } else {
          setReservation(data);
        }
      })
      .catch(() => setError("読み込みに失敗しました"))
      .finally(() => setLoading(false));
  }, [reservationId]);

  const handleCancel = async () => {
    if (!confirm("本当に予約をキャンセルしますか？")) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/reservations/${reservationId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setError("キャンセルに失敗しました");
        return;
      }
      setCancelled(true);
    } catch {
      setError("キャンセルに失敗しました");
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg text-gray-500">読み込み中...</div>
      </div>
    );
  }

  if (cancelled) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <div className="rounded-2xl bg-white p-8 shadow-lg text-center">
          <div className="mb-4 text-5xl">&#10003;</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            キャンセル完了
          </h1>
          <p className="text-gray-600">
            ご予約をキャンセルしました。またのご予約をお待ちしております。
          </p>
        </div>
      </div>
    );
  }

  if (error && !reservation) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <div className="rounded-2xl bg-white p-8 shadow-lg text-center">
          <p className="text-red-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!reservation) return null;

  const event = reservation.timeSlot.event;
  const slot = reservation.timeSlot;

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <div className="rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="text-xl font-bold mb-4">予約のキャンセル</h1>
        <p className="text-gray-600 mb-6">
          以下の予約をキャンセルしますか？
        </p>
        <div className="rounded-lg bg-gray-50 p-4 mb-6 space-y-2 text-sm">
          <div>
            <span className="font-semibold">イベント:</span> {event.title}
          </div>
          <div>
            <span className="font-semibold">日付:</span> {event.date}
          </div>
          <div>
            <span className="font-semibold">時間:</span> {slot.startTime} -{" "}
            {slot.endTime}
          </div>
          <div>
            <span className="font-semibold">お名前:</span> {reservation.name}
          </div>
          <div>
            <span className="font-semibold">人数:</span>{" "}
            {reservation.partySize}名
          </div>
          {event.location && (
            <div>
              <span className="font-semibold">場所:</span> {event.location}
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 mb-4">
            {error}
          </div>
        )}

        <button
          onClick={handleCancel}
          disabled={cancelling}
          className="w-full rounded-lg bg-red-500 px-6 py-3 text-white font-medium hover:bg-red-600 disabled:opacity-50 transition"
        >
          {cancelling ? "キャンセル中..." : "予約をキャンセルする"}
        </button>
      </div>
    </div>
  );
}
