import { describe, it, expect } from "vitest";
import { isPlaceholder, differs, isSameShow } from "@/lib/sync/helpers";

describe("isPlaceholder", () => {
  it.each([null, undefined, "", "TBC", "tbc", "TBA", "  tba  "])("treats %j as placeholder", (v) => {
    expect(isPlaceholder(v as string | null)).toBe(true);
  });

  it("does not treat a real value as placeholder", () => {
    expect(isPlaceholder("Printworks London")).toBe(false);
  });
});

describe("differs", () => {
  it("ignores surrounding whitespace", () => {
    expect(differs("  Berlin ", "Berlin")).toBe(false);
  });
  it("detects real differences", () => {
    expect(differs("Berlin", "Munich")).toBe(true);
  });
});

describe("isSameShow (double-header collision handling)", () => {
  it("merges events with matching city/venue", () => {
    expect(isSameShow({ city: "Ibiza", venue: "Hï" }, { city: "Ibiza", venue: "Hï" })).toBe(true);
  });

  it("splits events with the same date but different venues (double header)", () => {
    expect(isSameShow({ city: "Ibiza", venue: "Hï" }, { city: "Ibiza", venue: "Ushuaïa" })).toBe(false);
  });

  it("splits events with different cities (travel day)", () => {
    expect(isSameShow({ city: "Berlin", venue: "" }, { city: "Munich", venue: "" })).toBe(false);
  });

  it("merges when one side is missing city/venue info", () => {
    expect(isSameShow({ city: "", venue: "" }, { city: "Ibiza", venue: "Hï" })).toBe(true);
  });
});
