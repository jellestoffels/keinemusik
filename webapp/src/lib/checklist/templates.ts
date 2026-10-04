import { prisma } from "@/lib/prisma";

/**
 * Picks the checklist template key for a show, mirroring the legacy
 * `ensureFolderAndChecklist()` artist-matching logic: "keinemusik" for any
 * Keinemusik show, "duo" for multi-artist shows, the artist's own lowercased
 * name if a dedicated template exists, otherwise "default".
 */
export async function resolveChecklistTemplateKey(artists: string[]): Promise<string> {
  const parts = artists.map((a) => a.trim().toLowerCase()).filter(Boolean);
  if (parts.some((p) => p.includes("keinemusik"))) return "keinemusik";
  if (parts.length > 1) return "duo";

  const single = parts[0] ?? "";
  if (single) {
    const match = await prisma.checklistTemplateItem.findFirst({
      where: { template: single },
      select: { template: true },
    });
    if (match) return match.template;
  }
  return "default";
}

/** Builds the initial (unchecked) ChecklistItem rows for a newly created show. */
export async function buildChecklistItemsForTemplate(showId: string, templateKey: string) {
  const items = await prisma.checklistTemplateItem.findMany({
    where: { template: templateKey },
    orderBy: { sortOrder: "asc" },
  });
  return items.map((item) => ({
    showId,
    name: item.name,
    category: item.category,
    details: item.details,
    deadlineDays: item.deadlineDays,
    sortOrder: item.sortOrder,
    checked: false,
  }));
}
