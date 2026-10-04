import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toShowDTO } from "@/lib/serialize";
import { CREW_ROLES } from "@/lib/constants";
import type { DashboardDataDTO } from "@/types/dto";

/** Mirrors the legacy Apps Script `getAllData()`: a single bundle with shows + lookup options. */
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [shows, persons, emailTemplates] = await Promise.all([
    prisma.show.findMany({
      include: { checklistItems: { select: { checked: true } } },
      orderBy: { date: "asc" },
    }),
    prisma.person.findMany(),
    prisma.emailTemplate.findMany(),
  ]);

  const crewOptions: Record<string, string[]> = {};
  for (const role of CREW_ROLES) crewOptions[role] = [];
  const artistSet = new Set<string>();

  for (const person of persons) {
    if (person.artist) artistSet.add(person.artist);
    for (const role of person.roles) {
      if (crewOptions[role]) crewOptions[role].push(person.name);
    }
  }
  for (const role of Object.keys(crewOptions)) {
    crewOptions[role] = [...new Set(crewOptions[role])].sort();
  }

  for (const show of shows) {
    show.artists.forEach((a) => artistSet.add(a));
  }

  const emailTemplateMap = Object.fromEntries(emailTemplates.map((t) => [t.artistKey, t.message]));

  const payload: DashboardDataDTO = {
    shows: shows.map(toShowDTO),
    crewOptions,
    artistOptions: Array.from(artistSet).sort(),
    emailTemplates: emailTemplateMap,
  };

  return NextResponse.json(payload);
}
