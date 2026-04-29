import { NextResponse } from "next/server";
import { eq, asc } from "drizzle-orm";
import { getDb } from "@/db";
import { events, timeSlots, reservations } from "@/db/schema";
import { requireEventOwner } from "@/lib/api-auth";

// GET export reservations as CSV (auth + ownership required)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId: eid } = await params;
  const auth = await requireEventOwner(eid);
  if ("error" in auth) return auth.error;
  const db = await getDb();
  const eventId = eid;
  const url = new URL(request.url);
  const format = url.searchParams.get("format") || "csv";

  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
    with: {
      timeSlots: {
        orderBy: asc(timeSlots.sortOrder),
        with: {
          reservations: { orderBy: asc(reservations.createdAt) },
        },
      },
    },
  });

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const rows = event.timeSlots.flatMap((slot) =>
    slot.reservations.map((r) => {
      const additionalNames: string[] = r.additionalNames
        ? (JSON.parse(r.additionalNames) as string[])
        : [];
      return {
        name: r.name,
        email: r.email,
        partySize: r.partySize,
        additionalNames,
        startTime: slot.startTime,
        endTime: slot.endTime,
        createdAt: r.createdAt,
      };
    })
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
  const header = "代表者,メールアドレス,人数,同伴者,開始時間,終了時間,予約日時";
  const csvRows = rows.map(
    (r) =>
      `"${r.name}","${r.email}",${r.partySize},"${r.additionalNames.join(" / ")}","${r.startTime}","${r.endTime}","${new Date(r.createdAt).toLocaleString("ja-JP")}"`
  );
  const csv = BOM + [header, ...csvRows].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${event.title}_reservations.csv"`,
    },
  });
}
