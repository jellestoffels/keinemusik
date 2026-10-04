import { COUNTRY_MAP } from "@/lib/constants";

export interface ParsedIcalEvent {
  skipped: false;
  rawSummary: string;
  summary: string;
  date: Date;
  dateStr: string;
  venue: string;
  city: string;
  country: string;
  description: string;
  capacity: string;
  doors: string;
  time: string;
  stageTime: string;
  artists: string[];
}

export interface SkippedIcalEvent {
  skipped: true;
  rawSummary: string;
  reason: string;
}

export type IcalEvent = ParsedIcalEvent | SkippedIcalEvent;

/**
 * Ported 1:1 from the legacy Apps Script `fetchAndParseICal()`. Fetches a public
 * .ics feed and parses each VEVENT block using the same heuristics (title
 * splitting on "@"/" - ", flight-line filtering, DESCRIPTION venue block
 * extraction, country code normalization, etc).
 */
export async function fetchAndParseIcal(url: string): Promise<IcalEvent[]> {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (response.status !== 200) return [];

    const text = await response.text();
    if (!text.includes("BEGIN:VEVENT")) return [];

    return parseIcalText(text);
  } catch {
    return [];
  }
}

export function parseIcalText(text: string): IcalEvent[] {
  const events: IcalEvent[] = [];
  const rawEvents = text.split("BEGIN:VEVENT");

  const rgxStart = /DTSTART(?:;.*?)?:(\w+)/;
  const rgxSummary = /SUMMARY:(.*)/;
  const rgxCap = /Capacity:\s*(\d+)/i;
  const rgxDoors = /Doors open:\s*([\d:]+)/i;
  const rgxTime = /Stage time:\s*(.*)|Time:\s*(.*)/i;
  const rgxStageTimeDesc = /Stage time:([^\n]*)/i;

  for (let i = 1; i < rawEvents.length; i++) {
    const block = rawEvents[i];
    const unfolded = block.replace(/\r\n\s/g, "");

    let rawSummary = "";
    const mSum = unfolded.match(rgxSummary);
    if (mSum) rawSummary = mSum[1].trim();

    const isLikelyShow = rawSummary.includes(" @ ") || rawSummary.includes(" - ");
    if (!isLikelyShow && rawSummary.match(/(\s»\s|Flight\s|\[[A-Z]{3}\]|\b[A-Z]{2}\s?\d{3,4}\b)/i)) {
      events.push({ skipped: true, rawSummary, reason: "Matched flight regex" });
      continue;
    }

    const summary = rawSummary.replace(/\\,/g, ",");
    if (summary.includes("»")) continue;

    let date = new Date();
    let dateStr = "";
    const mStart = unfolded.match(rgxStart);
    if (mStart) {
      const dStr = mStart[1];
      const y = parseInt(dStr.substring(0, 4), 10);
      const m = parseInt(dStr.substring(4, 6), 10) - 1;
      const d = parseInt(dStr.substring(6, 8), 10);
      dateStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      date = new Date(Date.UTC(y, m, d));
    }

    let description = "";
    const mDesc = unfolded.match(/DESCRIPTION:(.*?)(\r\n[A-Z]+[:;]|\r\nEND:VEVENT)/s);
    if (mDesc) description = mDesc[1].replace(/\\n/g, "\n").replace(/\\,/g, ",");

    let venue = "";
    let city = "";
    let country = "";
    let artists: string[] = [];
    const titleBlob = summary;

    let artistPart = titleBlob;
    let locationPart = "";

    if (titleBlob.includes("@")) {
      const splitAt = titleBlob.split("@");
      artistPart = splitAt[0].trim();
      locationPart = splitAt[1].trim();
    } else if (titleBlob.includes(" - ")) {
      const splitDash = titleBlob.split(" - ");
      artistPart = splitDash[0].trim();
      locationPart = splitDash.slice(1).join(" - ").trim();
    }

    artists = artistPart
      .split(/,\s*|\s+and\s+|\s+vs\s+/i)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (!city && locationPart) {
      const dashParts = locationPart.split(" - ").map((s) => s.trim());
      if (dashParts.length >= 3) {
        country = dashParts[dashParts.length - 1];
        city = dashParts[dashParts.length - 2];
        venue = dashParts.slice(0, dashParts.length - 2).join(" - ");
      } else if (dashParts.length === 2) {
        city = dashParts[0];
        country = dashParts[1];
      } else {
        city = dashParts[0];
      }
    }

    const linesArr = description.split("\n").map((s) => s.trim());
    const vIdx = linesArr.findIndex((l) => l.toUpperCase() === "VENUE");
    if (vIdx !== -1) {
      const vLines: string[] = [];
      for (let k = vIdx + 1; k < linesArr.length; k++) {
        if (linesArr[k] === "") continue;
        if (
          linesArr[k].includes("---") ||
          linesArr[k].toUpperCase().startsWith("CAPACITY") ||
          linesArr[k].toUpperCase().startsWith("PROMOTER")
        )
          break;
        vLines.push(linesArr[k]);
      }
      if (vLines.length > 0) {
        if (vLines.length === 1) {
          venue = vLines[0];
        } else if (vLines.length === 2) {
          venue = vLines[0];
          city = vLines[1];
        } else if (vLines.length === 3) {
          venue = vLines[0];
          city = vLines[1];
          country = vLines[2];
        } else if (vLines.length >= 4) {
          venue = vLines[0];
          city = vLines[2];
          country = vLines[3];
        }
      }
    }

    if (city) {
      city = city.replace(/^[\d\-\s]+/, "").trim();
      if (city.endsWith(" A")) city = city.substring(0, city.length - 2).trim();
      if (city.includes("@") || city.includes("&") || city.length > 30) city = "";
    }

    if (country) {
      country = country.replace(/,/g, "").trim();
      if (country.length === 2 && country === country.toUpperCase()) {
        if (COUNTRY_MAP[country]) country = COUNTRY_MAP[country];
      }
      if (country.length > 20 || country === "A") country = "";
    }

    if (!city || city.length < 3) {
      events.push({ skipped: true, rawSummary, reason: `City missing or too short. Extracted City: '${city}'` });
      continue;
    }

    const mCap = description.match(rgxCap);
    const capacity = mCap ? mCap[1] : "";

    const mDoors = description.match(rgxDoors);
    const doors = mDoors ? mDoors[1] : "";

    const mTime = description.match(rgxTime);
    const time = mTime ? (mTime[1] || mTime[2] || "").trim() : "";

    let stageTime = "";
    const mStage = description.match(rgxStageTimeDesc);
    if (mStage && mStage[1]) stageTime = mStage[1].trim();

    events.push({
      skipped: false,
      rawSummary,
      summary,
      date,
      dateStr,
      venue,
      city,
      country,
      description,
      capacity,
      doors,
      time,
      stageTime,
      artists,
    });
  }
  return events;
}
