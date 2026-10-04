import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { syncShows } from "@/lib/sync/syncShows";

/** Manual sync, triggered from the dashboard "Sync" button. Requires an authenticated session. */
export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const result = await syncShows(true);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/** Scheduled sync, triggered by Vercel Cron (sends `Authorization: Bearer $CRON_SECRET`). */
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!expected || authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncShows(false);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
