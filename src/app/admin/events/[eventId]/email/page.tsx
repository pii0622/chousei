"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

interface Reservation {
  name: string;
  email: string;
  partySize: number;
}

interface TimeSlot {
  startTime: string;
  endTime: string;
  reservations: Reservation[];
}

interface Event {
  id: string;
  title: string;
  date: string;
  location: string;
  timeSlots: TimeSlot[];
}

export default function BulkEmailPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [copiedAddresses, setCopiedAddresses] = useState(false);

  useEffect(() => {
    fetch(`/api/events/${eventId}`)
      .then((r) => r.json() as Promise<Event & { error?: string }>)
      .then((data) => {
        if (!data.error) {
          setEvent(data);
          setSubject(`【ご案内】${data.title}`);
          setBody(getTemplate(data));
        }
      })
      .finally(() => setLoading(false));
  }, [eventId]);

  const getTemplate = (ev: Event): string => {
    return `いつもお世話になっております。

${ev.title} についてご案内いたします。

日付: ${ev.date}
${ev.location ? `場所: ${ev.location}\n` : ""}
ご来場をお待ちしております。`;
  };

  const getAllEmails = (): string[] => {
    if (!event) return [];
    const emails = new Set<string>();
    event.timeSlots.forEach((slot) =>
      slot.reservations.forEach((r) => emails.add(r.email))
    );
    return Array.from(emails);
  };

  const getEmailsFormatted = (): string => {
    if (!event) return "";
    const entries = new Set<string>();
    event.timeSlots.forEach((slot) =>
      slot.reservations.forEach((r) =>
        entries.add(`"${r.name}" <${r.email}>`)
      )
    );
    return Array.from(entries).join(", ");
  };

  const handleCopyAddresses = async () => {
    await navigator.clipboard.writeText(getEmailsFormatted());
    setCopiedAddresses(true);
    setTimeout(() => setCopiedAddresses(false), 2000);
  };

  const handleOpenMailer = () => {
    const emails = getAllEmails();
    const bcc = emails.join(",");
    const encodedSubject = encodeURIComponent(subject);
    const encodedBody = encodeURIComponent(body);
    window.location.href = `mailto:?bcc=${bcc}&subject=${encodedSubject}&body=${encodedBody}`;
  };

  const insertVariable = (variable: string) => {
    setBody((prev) => prev + variable);
  };

  if (loading) {
    return <div className="text-gray-500">読み込み中...</div>;
  }

  if (!event) {
    return <div className="text-red-500">イベントが見つかりません</div>;
  }

  const totalRecipients = getAllEmails().length;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">一括メール送信</h1>
        <button
          onClick={() => router.back()}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← 戻る
        </button>
      </div>

      <div className="rounded-xl bg-white p-6 shadow">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{event.title}</h2>
          <span className="text-sm text-gray-500">
            送信先: {totalRecipients}名
          </span>
        </div>

        {totalRecipients === 0 ? (
          <p className="text-gray-400">予約者がいません。</p>
        ) : (
          <div className="space-y-4">
            {/* Subject */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                件名
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Body */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                本文
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={12}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-sm"
              />
              <div className="mt-1 flex flex-wrap gap-2">
                <span className="text-xs text-gray-400">変数を挿入:</span>
                <button
                  type="button"
                  onClick={() => insertVariable(event.title)}
                  className="text-xs bg-gray-100 px-2 py-0.5 rounded hover:bg-gray-200"
                >
                  イベント名
                </button>
                <button
                  type="button"
                  onClick={() => insertVariable(event.date)}
                  className="text-xs bg-gray-100 px-2 py-0.5 rounded hover:bg-gray-200"
                >
                  日付
                </button>
                <button
                  type="button"
                  onClick={() => insertVariable(event.location)}
                  className="text-xs bg-gray-100 px-2 py-0.5 rounded hover:bg-gray-200"
                >
                  場所
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="border-t pt-4 space-y-3">
              <button
                onClick={handleOpenMailer}
                className="w-full rounded-lg bg-blue-600 px-6 py-3 text-white font-medium hover:bg-blue-700 transition"
              >
                メーラーで送信（BCC: {totalRecipients}名）
              </button>

              <div className="flex gap-3">
                <button
                  onClick={handleCopyAddresses}
                  className="flex-1 rounded-lg bg-gray-100 px-4 py-2.5 text-sm text-gray-700 font-medium hover:bg-gray-200 transition"
                >
                  {copiedAddresses
                    ? "コピーしました!"
                    : "BCC用アドレスをコピー"}
                </button>
              </div>

              <p className="text-xs text-gray-400">
                「メーラーで送信」をクリックすると、お使いのメールアプリが開きます。
                BCC欄に全予約者のアドレスが入っているのを確認して送信してください。
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
