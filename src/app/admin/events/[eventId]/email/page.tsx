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
  title: string | null;
  reservations: Reservation[];
}

interface Event {
  id: string;
  title: string;
  date: string;
  location: string;
  timeSlots: TimeSlot[];
}

interface EmailTemplate {
  id: string;
  label: string;
  subject: string;
  body: string;
}

function getTemplates(ev: Event): EmailTemplate[] {
  return [
    {
      id: "reminder",
      label: "リマインド",
      subject: `【リマインド】${ev.title}`,
      body: `いつもお世話になっております。

${ev.title} のリマインドをお送りいたします。

日付: ${ev.date}
${ev.location ? `場所: ${ev.location}\n` : ""}
お時間に合わせてお越しください。
ご来場をお待ちしております。`,
    },
    {
      id: "day-before",
      label: "前日リマインド",
      subject: `【明日開催】${ev.title}`,
      body: `いつもお世話になっております。

明日は${ev.title}の開催日です。

日付: ${ev.date}
${ev.location ? `場所: ${ev.location}\n` : ""}
お気をつけてお越しください。
お会いできるのを楽しみにしております。`,
    },
    {
      id: "cancel",
      label: "イベント中止",
      subject: `【中止のお知らせ】${ev.title}`,
      body: `いつもお世話になっております。

誠に申し訳ございませんが、${ev.title}は都合により中止とさせていただくこととなりました。

日付: ${ev.date}

ご予約いただいていた皆さまには大変ご迷惑をおかけいたします。
何卒ご理解いただけますようお願い申し上げます。`,
    },
    {
      id: "thanks",
      label: "お礼",
      subject: `【ご来場ありがとうございました】${ev.title}`,
      body: `いつもお世話になっております。

先日は${ev.title}にご来場いただき、誠にありがとうございました。

皆さまにお楽しみいただけたなら幸いです。
今後ともよろしくお願いいたします。`,
    },
    {
      id: "custom",
      label: "カスタム",
      subject: `【ご案内】${ev.title}`,
      body: "",
    },
  ];
}

export default function BulkEmailPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);

  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("reminder");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [copiedAddresses, setCopiedAddresses] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(false);

  useEffect(() => {
    fetch(`/api/events/${eventId}`)
      .then((r) => r.json() as Promise<Event & { error?: string }>)
      .then((data) => {
        if (!data.error) {
          setEvent(data);
          const tpls = getTemplates(data);
          setTemplates(tpls);
          setSubject(tpls[0].subject);
          setBody(tpls[0].body);
        }
      })
      .finally(() => setLoading(false));
  }, [eventId]);

  const handleSelectTemplate = (id: string) => {
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) return;
    setSelectedTemplateId(id);
    setSubject(tpl.subject);
    setBody(tpl.body);
    setEditingTemplate(false);
  };

  const handleSaveTemplate = () => {
    setTemplates((prev) =>
      prev.map((t) =>
        t.id === selectedTemplateId
          ? { ...t, subject, body }
          : t
      )
    );
    setEditingTemplate(false);
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
            {/* Template Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                テンプレート
              </label>
              <div className="flex flex-wrap gap-2">
                {templates.map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => handleSelectTemplate(tpl.id)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                      selectedTemplateId === tpl.id
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>
            </div>

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
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">
                  本文
                </label>
                <button
                  onClick={() => {
                    if (editingTemplate) {
                      handleSaveTemplate();
                    } else {
                      setEditingTemplate(true);
                    }
                  }}
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  {editingTemplate
                    ? "テンプレートとして保存"
                    : "テンプレートを編集"}
                </button>
              </div>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={12}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-sm"
              />
              {editingTemplate && (
                <p className="mt-1 text-xs text-yellow-600">
                  編集中 — 「テンプレートとして保存」をクリックすると、このセッション中の「{templates.find((t) => t.id === selectedTemplateId)?.label}」テンプレートが更新されます。
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="border-t pt-4 space-y-3">
              <button
                onClick={handleOpenMailer}
                className="w-full rounded-lg bg-blue-600 px-6 py-3 text-white font-medium hover:bg-blue-700 transition"
              >
                メーラーで送信（BCC: {totalRecipients}名）
              </button>

              <button
                onClick={handleCopyAddresses}
                className="w-full rounded-lg bg-gray-100 px-4 py-2.5 text-sm text-gray-700 font-medium hover:bg-gray-200 transition"
              >
                {copiedAddresses
                  ? "コピーしました!"
                  : "BCC用アドレスをコピー"}
              </button>

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
