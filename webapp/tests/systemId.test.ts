import { describe, it, expect } from "vitest";
import { generateSystemId } from "@/lib/sync/systemId";

describe("generateSystemId", () => {
  it("builds a stable id from date + sorted artists", () => {
    expect(generateSystemId("2025-12-29", ["Rampa", "Adam Port"])).toBe("ICAL_2025-12-29_adamportrampa");
  });

  it("collapses any Keinemusik-inclusive lineup to just Keinemusik", () => {
    expect(generateSystemId("2026-07-08", ["Keinemusik", "&ME", "Rampa", "Adam Port"])).toBe(
      "ICAL_2026-07-08_keinemusik"
    );
  });

  it("is order-independent for the same artist set", () => {
    const a = generateSystemId("2025-05-01", ["Rampa", "&ME"]);
    const b = generateSystemId("2025-05-01", ["&ME", "Rampa"]);
    expect(a).toBe(b);
  });

  it("returns null for an invalid date", () => {
    expect(generateSystemId("not-a-date", ["Rampa"])).toBeNull();
  });

  it("falls back to 'unknown' when no artists are given", () => {
    expect(generateSystemId("2025-01-01", [])).toBe("ICAL_2025-01-01_unknown");
  });
});
