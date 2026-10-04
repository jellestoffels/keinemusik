import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { LogDTO } from "@/types/dto";

/** Mirrors the legacy Apps Script `getRecentLogs()`. */
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const logs = await prisma.log.findMany({ orderBy: { timestamp: "desc" }, take: 10 });

  const payload: LogDTO[] = logs.map((l) => ({
    id: l.id,
    date: l.timestamp.toISOString().slice(0, 16).replace("T", " "),
    type: l.type,
    desc: l.description,
  }));

  return NextResponse.json(payload);
}
