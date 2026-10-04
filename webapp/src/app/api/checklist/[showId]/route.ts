import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { ChecklistItemDTO } from "@/types/dto";

/** Mirrors the legacy Apps Script `getChecklistItems()`. */
export async function GET(_request: Request, { params }: { params: Promise<{ showId: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { showId } = await params;
  const items = await prisma.checklistItem.findMany({ where: { showId } });

  items.sort((a, b) => {
    if (a.checked !== b.checked) return a.checked ? 1 : -1;
    return b.deadlineDays - a.deadlineDays;
  });

  const payload: ChecklistItemDTO[] = items.map((i) => ({
    id: i.id,
    checked: i.checked,
    name: i.name,
    category: i.category,
    details: i.details,
    deadlineDays: i.deadlineDays,
  }));

  return NextResponse.json(payload);
}
