import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/** Bulk-delete shows (used to confirm removal of "orphan" shows missing from the feeds). */
export async function DELETE(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const ids: unknown = body?.ids;
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string")) {
    return NextResponse.json({ error: "Expected { ids: string[] }" }, { status: 400 });
  }

  const shows = await prisma.show.findMany({ where: { id: { in: ids } } });
  await prisma.show.deleteMany({ where: { id: { in: ids } } });

  if (shows.length > 0) {
    await prisma.log.createMany({
      data: shows.map((s) => ({
        type: "Deleted Show",
        description: `Removed cancelled/missing show: ${s.formattedName ?? s.systemId} on ${s.date.toISOString().slice(0, 10)}`,
      })),
    });
  }

  return NextResponse.json({ success: true, deleted: shows.length });
}
