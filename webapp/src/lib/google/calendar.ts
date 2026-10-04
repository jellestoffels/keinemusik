import { calendar } from "@googleapis/calendar";
import { getServiceAccountAuth } from "@/lib/google/auth";
import { fetchAndParseIcal, parseIcalText, type IcalEvent } from "@/lib/sync/icalParser";

export { fetchAndParseIcal, parseIcalText, type IcalEvent };

/**
 * Optional alternate sync path: pull events directly from the Google Calendar
 * API (v3) for feeds configured with a `calendarId` (the calendar must be
 * shared with the service account). The response is converted to raw .ics
 * VEVENT text so it can be run through the exact same `parseIcalText()` logic
 * used for public .ics URL feeds, keeping parsing/business-rules identical
 * regardless of the transport.
 *
 * The production sync (`syncShows.ts`) defaults to fetching public .ics URLs
 * (matching the legacy Apps Script behaviour) and only uses this path when an
 * `IcalFeed.calendarId` is set.
 */
export async function fetchCalendarApiEventsAsIcal(calendarId: string): Promise<IcalEvent[]> {
  const client = calendar({ version: "v3", auth: getServiceAccountAuth() });

  const timeMin = new Date();
  timeMin.setDate(timeMin.getDate() - 1);

  const res = await client.events.list({
    calendarId,
    timeMin: timeMin.toISOString(),
    maxResults: 2500,
    singleEvents: true,
    orderBy: "startTime",
  });

  const events = res.data.items ?? [];
  const blocks = events.map((evt) => eventToIcalBlock(evt));
  const pseudoIcs = `BEGIN:VCALENDAR\n${blocks.join("\n")}\nEND:VCALENDAR`;
  return parseIcalText(pseudoIcs);
}

function eventToIcalBlock(evt: {
  summary?: string | null;
  description?: string | null;
  start?: { date?: string | null; dateTime?: string | null } | null;
}): string {
  const dt = evt.start?.date ? evt.start.date.replace(/-/g, "") : (evt.start?.dateTime ?? "").replace(/[-:]/g, "").slice(0, 8);
  const summary = (evt.summary ?? "").replace(/,/g, "\\,");
  const description = (evt.description ?? "").replace(/\n/g, "\\n").replace(/,/g, "\\,");
  return [
    "BEGIN:VEVENT",
    `DTSTART:${dt}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    "END:VEVENT",
  ].join("\r\n");
}
