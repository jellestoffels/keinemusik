import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const feeds = await prisma.icalFeed.findMany({ orderBy: { artist: "asc" } });
  return NextResponse.json(feeds);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const artist = String(body?.artist ?? "").trim();
  const url = String(body?.url ?? "").trim();
  if (!artist || !url) return NextResponse.json({ error: "artist and url are required" }, { status: 400 });

  const feed = await prisma.icalFeed.create({
    data: { artist, url, calendarId: body?.calendarId || null },
  });
  return NextResponse.json(feed, { status: 201 });
}
