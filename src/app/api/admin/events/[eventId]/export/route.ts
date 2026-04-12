import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET export reservations as CSV
export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const url = new URL(request.url);
  const format = url.searchParams.get("format") || "csv";

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      timeSlots: {
        orderBy: { sortOrder: "asc" },
        include: {
          reservations: {
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  });

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const rows = event.timeSlots.flatMap((slot) =>
    slot.reservations.map((r) => ({
      name: r.name,
      email: r.email,
      partySize: r.partySize,
      startTime: slot.startTime,
      endTime: slot.endTime,
      createdAt: r.createdAt,
    }))
  );

  if (format === "emails") {
    // Return comma-separated email list for mail software
    const emails = rows.map((r) => `"${r.name}" <${r.email}>`).join(", ");
    return new Response(emails, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  // CSV format
  const BOM = "\uFEFF";
  const header = "名前,メールアドレス,人数,開始時間,終了時間,予約日時";
  const csvRows = rows.map(
    (r) =>
      `"${r.name}","${r.email}",${r.partySize},"${r.startTime}","${r.endTime}","${new Date(r.createdAt).toLocaleString("ja-JP")}"`
  );
  const csv = BOM + [header, ...csvRows].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${event.title}_reservations.csv"`,
    },
  });
}
