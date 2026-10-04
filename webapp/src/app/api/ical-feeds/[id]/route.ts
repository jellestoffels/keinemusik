import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const data: Record<string, unknown> = {};
  if (typeof body?.active === "boolean") data.active = body.active;
  if (typeof body?.url === "string") data.url = body.url;
  if (typeof body?.artist === "string") data.artist = body.artist;
  if (typeof body?.calendarId === "string" || body?.calendarId === null) data.calendarId = body.calendarId;

  try {
    const feed = await prisma.icalFeed.update({ where: { id }, data });
    return NextResponse.json(feed);
  } catch {
    return NextResponse.json({ error: "Feed not found" }, { status: 404 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    await prisma.icalFeed.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Feed not found" }, { status: 404 });
  }
}
