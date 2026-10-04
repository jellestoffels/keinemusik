import { prisma } from "@/lib/prisma";
import { generateSystemId } from "@/lib/sync/systemId";
import { fetchAndParseIcal, fetchCalendarApiEventsAsIcal, type IcalEvent } from "@/lib/google/calendar";
import { ensureShowFolder } from "@/lib/google/drive";
import { geocodeVenue } from "@/lib/google/geocoding";
import { resolveChecklistTemplateKey, buildChecklistItemsForTemplate } from "@/lib/checklist/templates";
import { CREW_ROLES, type CrewRole } from "@/lib/constants";
import { isPlaceholder, differs, isSameShow } from "@/lib/sync/helpers";
import type { Show } from "@prisma/client";

const MAX_RUNTIME_MS = 55_000; // keep comfortably under Vercel's default serverless timeout

interface AggregatedShow {
  id: string;
  date: Date;
  city: string;
  venue: string;
  country: string;
  capacity: string;
  doors: string;
  time: string;
  stageTime: string;
  artists: string[];
  lat: number | null;
  lng: number | null;
}

export interface SyncOrphan {
  showId: string;
  name: string;
  date: string;
}

export interface SyncResult {
  message: string;
  added: number;
  updated: number;
  backfilled: number;
  deletedCancelled: number;
  orphans: SyncOrphan[];
  logs: string[];
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatName(date: Date, city: string, artists: string[]): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd} - ${city} (${artists.join(", ")})`;
}

async function loadCrewByArtist(): Promise<Record<string, Partial<Record<CrewRole, string[]>>>> {
  const persons = await prisma.person.findMany();
  const byArtist: Record<string, Partial<Record<CrewRole, string[]>>> = {};
  for (const p of persons) {
    if (!p.artist) continue;
    if (!byArtist[p.artist]) byArtist[p.artist] = {};
    for (const role of p.roles) {
      if (!(CREW_ROLES as readonly string[]).includes(role)) continue;
      const key = role as CrewRole;
      byArtist[p.artist][key] = [...(byArtist[p.artist][key] ?? []), p.name];
    }
  }
  return byArtist;
}

function assignCrew(artists: string[], byArtist: Record<string, Partial<Record<CrewRole, string[]>>>) {
  const result: Record<CrewRole, string[]> = {
    "Light Designer": [],
    "Light Operator": [],
    "Production Manager": [],
    "Sound Engineer": [],
  };
  for (const artist of artists) {
    const roles = byArtist[artist];
    if (!roles) continue;
    for (const role of CREW_ROLES) {
      if (roles[role]) result[role].push(...roles[role]!);
    }
  }
  return {
    ld: [...new Set(result["Light Designer"])],
    lo: [...new Set(result["Light Operator"])],
    pm: [...new Set(result["Production Manager"])],
    se: [...new Set(result["Sound Engineer"])],
  };
}

/**
 * Core recurring sync job, ported from the legacy Apps Script `syncApiData()`.
 * Fetches each active iCal feed, merges/de-duplicates events into shows,
 * reconciles against existing DB rows (healing stale system ids, filling in
 * placeholder fields), creates Drive folders + checklist items for new shows,
 * and (in manual mode) reports "orphan" shows that disappeared from the feeds
 * so a human can confirm deletion.
 */
export async function syncShows(isManual = false): Promise<SyncResult> {
  const startTime = Date.now();
  const detailedLogs: string[] = [];
  const persistedLogs: { type: string; description: string; showId?: string }[] = [];
  const today = startOfToday();

  // --- 1. Remove shows already marked Cancelled ---
  const cancelledShows = await prisma.show.findMany({ where: { statusPhase: "Cancelled" } });
  if (cancelledShows.length > 0) {
    await prisma.show.deleteMany({ where: { id: { in: cancelledShows.map((s) => s.id) } } });
    for (const s of cancelledShows) {
      persistedLogs.push({ type: "Deleted Show", description: `Removed cancelled/missing show: ${s.formattedName ?? s.systemId}` });
    }
    detailedLogs.push(`Deleted ${cancelledShows.length} cancelled shows.`);
  }

  // --- 2. Fetch + parse all active feeds ---
  const feeds = await prisma.icalFeed.findMany({ where: { active: true } });
  if (feeds.length === 0) {
    detailedLogs.push("No active iCal feeds configured.");
  }

  const crewByArtist = await loadCrewByArtist();
  const showsMap = new Map<string, AggregatedShow>();

  detailedLogs.push("--- PARSING CALENDARS ---");
  for (const feed of feeds) {
    let events: IcalEvent[] = [];
    try {
      events = feed.calendarId ? await fetchCalendarApiEventsAsIcal(feed.calendarId) : await fetchAndParseIcal(feed.url);
    } catch (e) {
      detailedLogs.push(`Failed to fetch feed for ${feed.artist}: ${(e as Error).message}`);
      continue;
    }
    detailedLogs.push(`Fetched ${feed.artist} feed: Found ${events.length} total blocks.`);

    for (const evt of events) {
      if (evt.skipped) {
        detailedLogs.push(`  Skipped: "${evt.rawSummary}" (${evt.reason})`);
        continue;
      }
      const checkDate = new Date(evt.date);
      checkDate.setHours(0, 0, 0, 0);
      if (checkDate < today) continue;

      const allEvtArtists = [...evt.artists, feed.artist];
      const baseId = generateSystemId(evt.dateStr, allEvtArtists);
      if (!baseId) continue;

      let uniqueId = baseId;
      let counter = 1;
      let checkId = baseId;
      let merged = false;

      while (showsMap.has(checkId)) {
        const existing = showsMap.get(checkId)!;

        if (isSameShow(existing, evt)) {
          uniqueId = checkId;
          merged = true;
          break;
        }
        counter++;
        checkId = `${baseId}-${counter}`;
      }
      if (!merged) uniqueId = checkId;

      detailedLogs.push(
        `  Valid Event Parsed: ${evt.dateStr} | City: ${evt.city || "TBC"} | Venue: ${evt.venue || "TBC"} | Assigned ID: ${uniqueId}`
      );

      let geo: { lat: number; lng: number } | null = null;
      if (Date.now() - startTime < MAX_RUNTIME_MS) {
        geo = await geocodeVenue(evt.venue, evt.city, evt.country);
      }

      if (!showsMap.has(uniqueId)) {
        showsMap.set(uniqueId, {
          id: uniqueId,
          date: evt.date,
          city: evt.city,
          venue: evt.venue,
          country: evt.country,
          capacity: evt.capacity || "",
          doors: evt.doors || "",
          time: evt.time || "",
          stageTime: evt.stageTime || "",
          artists: [],
          lat: geo?.lat ?? null,
          lng: geo?.lng ?? null,
        });
      }
      const entry = showsMap.get(uniqueId)!;
      evt.artists.forEach((a) => {
        if (!entry.artists.includes(a)) entry.artists.push(a);
      });
      if (!entry.artists.includes(feed.artist)) entry.artists.push(feed.artist);

      if (!entry.venue && evt.venue) entry.venue = evt.venue;
      if (!entry.capacity && evt.capacity) entry.capacity = evt.capacity;
      if (!entry.stageTime && evt.stageTime) entry.stageTime = evt.stageTime;
      if (!entry.time && evt.time) entry.time = evt.time;
      if (!entry.lat && geo) {
        entry.lat = geo.lat;
        entry.lng = geo.lng;
      }
    }
  }

  // --- 3. Load + heal existing shows ---
  detailedLogs.push("--- COMPARING TO DATABASE ---");
  const existingShows = await prisma.show.findMany();
  const sheetMap = new Map<string, Show & { healedId: string }>();

  for (const row of existingShows) {
    const baseId = generateSystemId(row.date.toISOString().slice(0, 10), row.artists);
    if (!baseId) continue;
    let healedId = row.systemId;
    if (!row.systemId || !row.systemId.startsWith(baseId)) {
      let candidate = baseId;
      let counter = 2;
      while (sheetMap.has(candidate)) {
        candidate = `${baseId}-${counter}`;
        counter++;
      }
      healedId = candidate;
    }
    sheetMap.set(healedId, { ...row, healedId });
  }

  // --- 4. Reconcile aggregated feed shows against existing DB rows ---
  let updateCount = 0;
  const newShows: AggregatedShow[] = [];

  for (const [, show] of showsMap) {
    const existing = sheetMap.get(show.id);
    if (existing) {
      const updates: Record<string, unknown> = {};
      let artistsUpdated = false;

      if (existing.systemId !== show.id) updates.systemId = show.id;

      const combinedArtists = [...existing.artists];
      show.artists.forEach((a) => {
        if (!combinedArtists.includes(a)) {
          combinedArtists.push(a);
          artistsUpdated = true;
        }
      });
      if (artistsUpdated) {
        updates.artists = combinedArtists;
        persistedLogs.push({
          type: "Artist Update",
          description: `Updated artists for ${show.city}: ${combinedArtists.join(", ")}`,
          showId: existing.id,
        });
      }

      const changesMade: string[] = [];
      if (show.venue && isPlaceholder(existing.venue) && differs(existing.venue, show.venue)) {
        updates.venue = show.venue;
        changesMade.push("Venue");
      }
      if (show.country && isPlaceholder(existing.country) && differs(existing.country, show.country)) {
        updates.country = show.country;
        changesMade.push("Country");
      }
      if (
        show.capacity &&
        isPlaceholder(existing.capacity?.toString()) &&
        differs(existing.capacity?.toString(), show.capacity)
      ) {
        updates.capacity = parseInt(show.capacity, 10) || null;
        changesMade.push("Capacity");
      }
      if (show.stageTime && isPlaceholder(existing.stageTime) && differs(existing.stageTime, show.stageTime)) {
        updates.stageTime = show.stageTime;
        changesMade.push("StageTime");
      }
      if (show.city && isPlaceholder(existing.city) && differs(existing.city, show.city)) {
        updates.city = show.city;
        changesMade.push("City");
      }
      if ((!existing.venueLat || !existing.venueLng) && show.lat) {
        updates.venueLat = show.lat;
        updates.venueLng = show.lng;
      }

      if (Object.keys(updates).length > 0) {
        await prisma.show.update({ where: { id: existing.id }, data: updates });
      }
      if (changesMade.length > 0 || artistsUpdated) {
        updateCount++;
        detailedLogs.push(`Updated existing show (${show.id}): Overwrote [${changesMade.join(", ")}]`);
      }
    } else {
      detailedLogs.push(`Creating NEW show: ${show.date.toISOString().slice(0, 10)} | ${show.city || "TBC"} (${show.id})`);
      newShows.push(show);
    }
  }

  // --- 5. Create new shows (Drive folder + checklist + crew assignment) ---
  for (const show of newShows) {
    const fmtName = formatName(show.date, show.city, show.artists);

    let folder: { url: string; fileCount: number } | null = null;
    if (Date.now() - startTime < MAX_RUNTIME_MS) {
      try {
        folder = await ensureShowFolder(fmtName);
      } catch (e) {
        detailedLogs.push(`Drive folder creation failed for ${fmtName}: ${(e as Error).message}`);
      }
    }

    const crew = assignCrew(show.artists, crewByArtist);

    const created = await prisma.show.create({
      data: {
        systemId: show.id,
        date: show.date,
        artists: show.artists,
        venue: show.venue || null,
        city: show.city || null,
        country: show.country || null,
        formattedName: fmtName,
        folderUrl: folder?.url ?? null,
        folderEmailRaw: folder ? `Please upload files...\n\n${folder.url}` : null,
        performanceTime: show.time || null,
        capacity: show.capacity ? parseInt(show.capacity, 10) || null : null,
        doorsOpen: show.doors || null,
        venueLat: show.lat,
        venueLng: show.lng,
        lightDesigners: crew.ld,
        lightOperators: crew.lo,
        productionManagers: crew.pm,
        soundEngineers: crew.se,
        folderFileCount: folder?.fileCount ?? 0,
        stageTime: show.stageTime || null,
      },
    });

    const templateKey = await resolveChecklistTemplateKey(show.artists);
    const items = await buildChecklistItemsForTemplate(created.id, templateKey);
    if (items.length > 0) await prisma.checklistItem.createMany({ data: items });

    persistedLogs.push({ type: "New Show", description: `Added show: ${fmtName}`, showId: created.id });
  }

  // --- 6. Orphan detection (manual sync only) ---
  const orphans: SyncOrphan[] = [];
  if (isManual) {
    detailedLogs.push("--- CHECKING FOR MISSING SHOWS (ORPHANS) ---");
    for (const [healedId, existing] of sheetMap) {
      if (existing.date >= today && healedId.startsWith("ICAL_") && !showsMap.has(healedId)) {
        orphans.push({
          showId: existing.id,
          name: existing.formattedName || `${existing.city} (${existing.artists.join(", ")})`,
          date: existing.date.toISOString().slice(0, 10),
        });
        detailedLogs.push(`Missing from feed: ${existing.date.toISOString().slice(0, 10)} | ${existing.city} (${healedId})`);
      }
    }
  }

  // --- 7. Backfill missing Drive folders / checklist items on upcoming shows ---
  let backfillCount = 0;
  const upcomingIncomplete = await prisma.show.findMany({
    where: { date: { gte: today }, OR: [{ folderUrl: null }, { checklistItems: { none: {} } }] },
    include: { checklistItems: { select: { id: true } } },
  });

  for (const show of upcomingIncomplete) {
    if (Date.now() - startTime > MAX_RUNTIME_MS) break;

    if (!show.folderUrl && show.formattedName) {
      try {
        const folder = await ensureShowFolder(show.formattedName);
        await prisma.show.update({
          where: { id: show.id },
          data: {
            folderUrl: folder.url,
            folderFileCount: folder.fileCount,
            folderEmailRaw: `Please upload files...\n\n${folder.url}`,
          },
        });
        backfillCount++;
      } catch (e) {
        detailedLogs.push(`Backfill Drive folder failed for ${show.formattedName}: ${(e as Error).message}`);
      }
    }
    if (show.checklistItems.length === 0) {
      const templateKey = await resolveChecklistTemplateKey(show.artists);
      const items = await buildChecklistItemsForTemplate(show.id, templateKey);
      if (items.length > 0) await prisma.checklistItem.createMany({ data: items });
    }
  }

  if (persistedLogs.length > 0) {
    await prisma.log.createMany({ data: persistedLogs });
  }

  detailedLogs.push(`SYNC COMPLETE: Added ${newShows.length}, Updated ${updateCount}, Missing ${orphans.length}.`);

  return {
    message: `Synced ${newShows.length} new. Updated ${updateCount}. Backfilled ${backfillCount}.`,
    added: newShows.length,
    updated: updateCount,
    backfilled: backfillCount,
    deletedCancelled: cancelledShows.length,
    orphans,
    logs: detailedLogs,
  };
}
