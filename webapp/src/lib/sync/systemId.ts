/**
 * Ported 1:1 from the legacy Apps Script `generateSystemId()`.
 * Produces a stable de-duplication key for a show from its date + artist list,
 * e.g. "ICAL_2025-12-29_me". Used both at sync time and to "heal" ids on
 * existing records whose artists/date were edited.
 */
export function generateSystemId(dateInput: string | Date, artistsArray: string[]): string | null {
  let dateKey: string;
  if (typeof dateInput === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    dateKey = dateInput;
  } else {
    const d = new Date(dateInput);
    if (!dateInput || Number.isNaN(d.getTime())) return null;
    dateKey = d.toISOString().slice(0, 10);
  }

  let cleanArtists = [...new Set(artistsArray.map((a) => a.trim()).filter((a) => a))];
  if (cleanArtists.some((a) => a.toLowerCase() === "keinemusik")) {
    cleanArtists = ["Keinemusik"];
  }
  const artistKey = cleanArtists
    .sort()
    .join("")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  return `ICAL_${dateKey}_${artistKey || "unknown"}`;
}
