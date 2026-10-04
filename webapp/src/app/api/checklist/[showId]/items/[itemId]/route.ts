import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/** Mirrors the legacy Apps Script `toggleChecklistItem()`: flips checked state and returns new counts. */
export async function PATCH(request: Request, { params }: { params: Promise<{ showId: string; itemId: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { showId, itemId } = await params;
  const body = await request.json().catch(() => null);
  const checked = Boolean(body?.checked);

  try {
    await prisma.checklistItem.update({ where: { id: itemId, showId }, data: { checked } });
  } catch {
    return NextResponse.json({ error: "Checklist item not found" }, { status: 404 });
  }

  const items = await prisma.checklistItem.findMany({ where: { showId }, select: { checked: true } });
  const total = items.length;
  const checkedCount = items.filter((i) => i.checked).length;

  return NextResponse.json({ success: true, checklistChecked: checkedCount, checklistTotal: total });
}
