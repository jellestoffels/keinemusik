/**
 * Seeds the database from the legacy Apps Script CSV exports in ./seed-data.
 * Run with `npm run db:seed` (also invoked automatically by `prisma migrate dev`/`deploy`).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { PrismaClient, ShowStatus } from "@prisma/client";
import { CREW_ROLES } from "../src/lib/constants";

const prisma = new PrismaClient();
const DATA_DIR = path.join(__dirname, "seed-data");

function readCsv<T>(filename: string): T[] {
  const content = readFileSync(path.join(DATA_DIR, filename), "utf8");
  return parse(content, { columns: true, skip_empty_lines: true, relax_quotes: true, trim: false }) as T[];
}

function splitList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function toNullableInt(value: string | undefined): number | null {
  if (!value) return null;
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}

function toNullableFloat(value: string | undefined): number | null {
  if (!value) return null;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

const STATUS_LABEL_TO_ENUM: Record<string, ShowStatus> = {
  Option: ShowStatus.Option,
  Confirmed: ShowStatus.Confirmed,
  "To Do": ShowStatus.ToDo,
  Waiting: ShowStatus.Waiting,
  Done: ShowStatus.Done,
  Cancelled: ShowStatus.Cancelled,
};

async function seedRoles() {
  const rows = readCsv<{ Name: string }>("roles.csv");
  const names = new Set<string>([...rows.map((r) => r.Name.trim()).filter(Boolean), ...CREW_ROLES]);
  for (const name of names) {
    await prisma.role.upsert({ where: { name }, update: {}, create: { name } });
  }
  console.log(`Seeded ${names.size} roles.`);
}

async function seedPersons() {
  const rows = readCsv<{ Name: string; Role: string; Artist: string; "Email Address": string }>("persons.csv");
  let count = 0;
  for (const row of rows) {
    const name = row.Name?.trim();
    if (!name) continue;
    await prisma.person.create({
      data: {
        name,
        artist: row.Artist?.trim() || null,
        roles: splitList(row.Role),
        email: row["Email Address"]?.trim() || null,
      },
    });
    count++;
  }
  console.log(`Seeded ${count} persons.`);
}

async function seedEmailTemplates() {
  const content = readFileSync(path.join(DATA_DIR, "email-template.csv"), "utf8");
  const rows = parse(content, { columns: false, skip_empty_lines: true, relax_quotes: true }) as string[][];
  let count = 0;
  for (let i = 1; i < rows.length; i++) {
    const [artist, message] = rows[i];
    if (!artist) continue;
    await prisma.emailTemplate.upsert({
      where: { artistKey: artist.trim().toLowerCase() },
      update: { message },
      create: { artistKey: artist.trim().toLowerCase(), message },
    });
    count++;
  }
  console.log(`Seeded ${count} email templates.`);
}

async function seedLogs() {
  const rows = readCsv<{ datetime: string; type: string; description: string }>("log.csv");
  const data = rows
    .map((r) => {
      const timestamp = new Date(r.datetime);
      if (Number.isNaN(timestamp.getTime())) return null;
      return { timestamp, type: r.type, description: r.description };
    })
    .filter((r): r is { timestamp: Date; type: string; description: string } => r !== null);
  await prisma.log.createMany({ data });
  console.log(`Seeded ${data.length} log entries.`);
}

/**
 * The legacy checklist lived in per-show Google Sheet copies that weren't part
 * of the CSV export, so real item names/categories for historical shows are
 * not recoverable. To preserve the "N / M completed" progress visible in the
 * CSV (`progress` column, e.g. "15,20") without inventing fictitious task
 * descriptions, seed that many *generic* placeholder items per show, marking
 * the first N as checked. Replace these with real checklist content (or edit
 * `ChecklistTemplateItem` rows so newly *created* shows get a proper
 * template) after go-live.
 */
function buildPlaceholderChecklistItems(progressRaw: string | undefined) {
  if (!progressRaw) return [];
  const [checkedStr, totalStr] = progressRaw.split(",");
  const checked = parseInt(checkedStr, 10) || 0;
  const total = parseInt(totalStr, 10) || 0;
  if (total <= 0) return [];
  return Array.from({ length: total }, (_, i) => ({
    name: `Imported checklist item ${i + 1}`,
    category: "Imported",
    details: "Placeholder generated from legacy progress count; replace with real checklist content.",
    deadlineDays: Math.max(0, 60 - i * 5),
    checked: i < checked,
    sortOrder: i,
  }));
}

interface ShowCsvRow {
  Date: string;
  Artists: string;
  Venue: string;
  City: string;
  Country: string;
  "Sold Out": string;
  "Tickets Link": string;
  "System ID": string;
  "Formatted Name": string;
  "Venue File Request Email": string;
  "Event Name": string;
  "Event URL": string;
  "Performance Time": string;
  "Duration Days": string;
  Capacity: string;
  "Status Phase": string;
  Production: string;
  "Doors Open": string;
  "Doors Close": string;
  "Venue Street": string;
  "Venue State": string;
  "Venue Postal": string;
  "Venue Country Code": string;
  "Venue Phone": string;
  "Venue URL": string;
  "Venue Lat": string;
  "Venue Lng": string;
  "Tickets On Sale": string;
  "Light Designer": string;
  "Light Operator": string;
  "Production Manager": string;
  "Sound Engineer": string;
  "Checklist ID": string;
  progress: string;
  "Folder File Count": string;
  "Stage time": string;
  Setpiece: string;
}

async function seedShows() {
  const rows = readCsv<ShowCsvRow>("shows.csv");
  let count = 0;
  for (const row of rows) {
    if (!row["System ID"] || !row.Date) continue;

    const folderMatch = (row["Venue File Request Email"] || "").match(/(https?:\/\/[^\s]+)/i);

    const show = await prisma.show.create({
      data: {
        systemId: row["System ID"].trim(),
        date: new Date(row.Date),
        artists: splitList(row.Artists),
        venue: row.Venue || null,
        city: row.City || null,
        country: row.Country || null,
        soldOut: (row["Sold Out"] || "").trim().toLowerCase() === "yes",
        ticketsLink: row["Tickets Link"] || null,
        formattedName: row["Formatted Name"] || null,
        folderEmailRaw: row["Venue File Request Email"] || null,
        folderUrl: folderMatch ? folderMatch[0] : null,
        eventName: row["Event Name"] || null,
        eventUrl: row["Event URL"] || null,
        performanceTime: row["Performance Time"] || null,
        durationDays: toNullableInt(row["Duration Days"]),
        capacity: toNullableInt(row.Capacity),
        statusPhase: STATUS_LABEL_TO_ENUM[(row["Status Phase"] || "").trim()] ?? ShowStatus.Option,
        production: row.Production || null,
        doorsOpen: row["Doors Open"] || null,
        doorsClose: row["Doors Close"] || null,
        venueStreet: row["Venue Street"] || null,
        venueState: row["Venue State"] || null,
        venuePostal: row["Venue Postal"] || null,
        venueCountryCode: row["Venue Country Code"] || null,
        venuePhone: row["Venue Phone"] || null,
        venueUrl: row["Venue URL"] || null,
        venueLat: toNullableFloat(row["Venue Lat"]),
        venueLng: toNullableFloat(row["Venue Lng"]),
        ticketsOnSale: row["Tickets On Sale"] || null,
        lightDesigners: splitList(row["Light Designer"]),
        lightOperators: splitList(row["Light Operator"]),
        productionManagers: splitList(row["Production Manager"]),
        soundEngineers: splitList(row["Sound Engineer"]),
        legacyChecklistId: row["Checklist ID"] || null,
        folderFileCount: toNullableInt(row["Folder File Count"]) ?? 0,
        stageTime: row["Stage time"] || null,
        setpiece: row.Setpiece || null,
      },
    });

    const items = buildPlaceholderChecklistItems(row.progress);
    if (items.length > 0) {
      await prisma.checklistItem.createMany({ data: items.map((item) => ({ ...item, showId: show.id })) });
    }
    count++;
  }
  console.log(`Seeded ${count} shows.`);
}

/**
 * Default checklist templates for *newly created* shows (used by the sync
 * engine). The legacy per-artist templates lived in an external Google Sheet
 * (CHECKLIST_TEMPLATE_ID) that isn't part of this export - customize these
 * via Prisma Studio or a migration once the real task lists are available.
 */
async function seedChecklistTemplates() {
  const existing = await prisma.checklistTemplateItem.count();
  if (existing > 0) return;

  const defaultItems = [
    { name: "Venue / stage 3D file received", category: "Venue", deadlineDays: 60 },
    { name: "Rental supplier catalog received", category: "Venue", deadlineDays: 60 },
    { name: "Venue photos received", category: "Venue", deadlineDays: 45 },
    { name: "Stage + FOH view photos received", category: "Venue", deadlineDays: 45 },
    { name: "Capacity confirmed", category: "Production", deadlineDays: 30 },
    { name: "Power / rigging specs received", category: "Production", deadlineDays: 30 },
    { name: "Light plot drafted", category: "Light Design", deadlineDays: 21 },
    { name: "Crew travel booked", category: "Logistics", deadlineDays: 14 },
    { name: "Show file finalized", category: "Light Design", deadlineDays: 7 },
    { name: "Advance call completed", category: "Production", deadlineDays: 3 },
  ];

  for (const template of ["default", "keinemusik", "duo"]) {
    await prisma.checklistTemplateItem.createMany({
      data: defaultItems.map((item, i) => ({ ...item, template, sortOrder: i })),
    });
  }
  console.log("Seeded default checklist templates (default, keinemusik, duo).");
}

async function main() {
  console.log(`Seeding from ${DATA_DIR}`);
  await seedRoles();
  await seedPersons();
  await seedEmailTemplates();
  await seedChecklistTemplates();
  await seedShows();
  await seedLogs();
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
