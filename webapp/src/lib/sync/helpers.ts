/** Small pure helpers shared by the sync engine; kept separate so they're easy to unit test. */

export function normalizeForComparison(s: string | null | undefined): string {
  return (s || "").toLowerCase().replace(/[^a-z]/g, "");
}

/** A field counts as a "placeholder" if a feed-derived value is allowed to overwrite it. */
export function isPlaceholder(value: string | null | undefined): boolean {
  if (!value) return true;
  const s = value.trim().toUpperCase();
  return s === "" || s === "TBC" || s === "TBA";
}

export function differs(a: string | null | undefined, b: string | undefined): boolean {
  return (a || "").trim() !== (b || "").trim();
}

/**
 * Decides whether two events sharing the same base system id represent the
 * same real-world show (should be merged) or a genuinely different show that
 * needs a collision-suffixed id (e.g. a double-header on the same date).
 */
export function isSameShow(
  existing: { city?: string | null; venue?: string | null },
  incoming: { city?: string | null; venue?: string | null }
): boolean {
  const c1 = normalizeForComparison(existing.city);
  const c2 = normalizeForComparison(incoming.city);
  const v1 = normalizeForComparison(existing.venue);
  const v2 = normalizeForComparison(incoming.venue);

  if (v1 && v2 && v1 !== v2) return false;
  if (c1 && c2 && c1 !== c2) return false;
  return true;
}
