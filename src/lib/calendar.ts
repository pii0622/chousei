export function generateGoogleCalendarUrl(params: {
  title: string;
  description: string;
  location: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
}): string {
  const { title, description, location, date, startTime, endTime } = params;
  const dateClean = date.replace(/-/g, "");
  const startClean = startTime.replace(/:/g, "") + "00";
  const endClean = endTime.replace(/:/g, "") + "00";

  const url = new URL("https://calendar.google.com/calendar/render");
  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set("text", title);
  url.searchParams.set("dates", `${dateClean}T${startClean}/${dateClean}T${endClean}`);
  url.searchParams.set("details", description);
  url.searchParams.set("location", location);

  return url.toString();
}

export function generateICS(params: {
  title: string;
  description: string;
  location: string;
  date: string;
  startTime: string;
  endTime: string;
}): string {
  const { title, description, location, date, startTime, endTime } = params;
  const dateClean = date.replace(/-/g, "");
  const startClean = startTime.replace(/:/g, "") + "00";
  const endClean = endTime.replace(/:/g, "") + "00";

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Chousei//Event//JP",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `DTSTART:${dateClean}T${startClean}`,
    `DTEND:${dateClean}T${endClean}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description.replace(/\n/g, "\\n")}`,
    `LOCATION:${location}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
