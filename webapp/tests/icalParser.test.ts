import { describe, it, expect } from "vitest";
import { parseIcalText } from "@/lib/sync/icalParser";

const SAMPLE_ICS = [
  "BEGIN:VCALENDAR",
  "BEGIN:VEVENT",
  "DTSTART:20260501T000000Z",
  "SUMMARY:Rampa @ Hajógyári Island - Budapest - Hungary",
  "DESCRIPTION:Capacity: 5000\\nDoors open: 14:00\\nStage time: 19:30-21:30 TBC",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "DTSTART:20260115T000000Z",
  "SUMMARY:AB 1234 Flight",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

describe("parseIcalText", () => {
  it("parses a valid show event", () => {
    const events = parseIcalText(SAMPLE_ICS);
    const valid = events.find((e) => !e.skipped);
    expect(valid).toBeDefined();
    if (!valid || valid.skipped) throw new Error("expected a parsed event");
    expect(valid.artists).toEqual(["Rampa"]);
    expect(valid.city).toBe("Budapest");
    expect(valid.country).toBe("Hungary");
    expect(valid.venue).toBe("Hajógyári Island");
    expect(valid.capacity).toBe("5000");
    expect(valid.stageTime).toContain("19:30-21:30");
  });

  it("skips flight-like entries", () => {
    const events = parseIcalText(SAMPLE_ICS);
    const skipped = events.find((e) => e.skipped);
    expect(skipped).toBeDefined();
  });
});
