import { drive, drive_v3 } from "@googleapis/drive";
import { getServiceAccountAuth, getUserDriveAuth } from "@/lib/google/auth";
import { getEnv } from "@/lib/env";

const FOLDER_MIME = "application/vnd.google-apps.folder";

function driveClient() {
  return drive({ version: "v3", auth: getServiceAccountAuth() });
}

/** Escapes a Drive `name` value for safe inclusion inside a `q` query string literal. */
function escapeDriveQueryValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function findChildFolder(
  drive: drive_v3.Drive,
  parentId: string,
  name: string
): Promise<drive_v3.Schema$File | null> {
  const res = await drive.files.list({
    q: `'${parentId}' in parents and name = '${escapeDriveQueryValue(name)}' and mimeType = '${FOLDER_MIME}' and trashed = false`,
    fields: "files(id, name, webViewLink)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    corpora: "allDrives",
  });
  return res.data.files?.[0] ?? null;
}

async function createChildFolder(
  drive: drive_v3.Drive,
  parentId: string,
  name: string
): Promise<drive_v3.Schema$File> {
  const res = await drive.files.create({
    requestBody: { name, mimeType: FOLDER_MIME, parents: [parentId] },
    fields: "id, name, webViewLink",
    supportsAllDrives: true,
  });
  return res.data;
}

/** Finds or creates a single-level child folder, mirroring legacy `createNestedFolder()` per-segment behaviour. */
async function ensureChildFolder(drive: drive_v3.Drive, parentId: string, name: string) {
  const existing = await findChildFolder(drive, parentId, name);
  if (existing?.id) return existing;
  return createChildFolder(drive, parentId, name);
}

export interface ShowFolderResult {
  id: string;
  url: string;
  fileCount: number;
  created: boolean;
}

const DEFAULT_SHOW_SUBFOLDERS = [
  "1 - Venue details (UPLOAD HERE)",
  "2 - Light and Stage Design",
  "3 - Sound",
  "0 - Archive",
];

/**
 * Ensures a per-show Drive folder exists under `GOOGLE_DRIVE_FOLDER_ID/GOOGLE_DRIVE_SHOWS_PATH`,
 * creating the standard subfolder structure on first creation. Ported from
 * the legacy `ensureFolderAndChecklist()` (Drive portion only - checklist
 * items now live in Postgres, seeded separately via `checklist/templates.ts`).
 */
export async function ensureShowFolder(formattedName: string): Promise<ShowFolderResult> {
  const env = getEnv();
  const drive = driveClient();

  const safeName = formattedName.replace(/[/\\:*?"<>|]/g, "-");

  let parentId = env.GOOGLE_DRIVE_FOLDER_ID;
  for (const segment of env.GOOGLE_DRIVE_SHOWS_PATH.split("/").filter(Boolean)) {
    const folder = await ensureChildFolder(drive, parentId, segment);
    if (!folder.id) throw new Error(`Failed to create/find Drive segment "${segment}"`);
    parentId = folder.id;
  }

  const existing = await findChildFolder(drive, parentId, safeName);
  let folderId: string;
  let created = false;

  if (existing?.id) {
    folderId = existing.id;
  } else {
    const folder = await createChildFolder(drive, parentId, safeName);
    if (!folder.id) throw new Error(`Failed to create show folder "${safeName}"`);
    folderId = folder.id;
    created = true;
    await Promise.all(DEFAULT_SHOW_SUBFOLDERS.map((sub) => createChildFolder(drive, folderId, sub)));
  }

  const fileCount = await countFilesRecursively(drive, folderId);

  return {
    id: folderId,
    url: `https://drive.google.com/drive/folders/${folderId}`,
    fileCount,
    created,
  };
}

/** Recursively counts non-folder files under a Drive folder. Ported from `countFilesRecursively()`. */
export async function countFilesRecursively(drive: drive_v3.Drive, folderId: string): Promise<number> {
  let count = 0;
  let pageToken: string | undefined;
  const subfolderIds: string[] = [];

  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "nextPageToken, files(id, mimeType)",
      pageSize: 1000,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      corpora: "allDrives",
    });
    for (const f of res.data.files ?? []) {
      if (f.mimeType === FOLDER_MIME) {
        if (f.id) subfolderIds.push(f.id);
      } else {
        count++;
      }
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  for (const sub of subfolderIds) {
    count += await countFilesRecursively(drive, sub);
  }
  return count;
}

export async function getShowFolderFileCount(folderId: string): Promise<number> {
  return countFilesRecursively(driveClient(), folderId);
}

/**
 * Access-control check: does the signed-in user (identified by their own OAuth
 * access token) have at least read access to the configured Drive parent
 * folder? Used by the auth callbacks / middleware to gate app access.
 */
export async function userHasDriveFolderAccess(accessToken: string): Promise<boolean> {
  const env = getEnv();
  try {
    const userDrive = drive({ version: "v3", auth: getUserDriveAuth(accessToken) });
    await userDrive.files.get({
      fileId: env.GOOGLE_DRIVE_FOLDER_ID,
      fields: "id",
      supportsAllDrives: true,
    });
    return true;
  } catch {
    return false;
  }
}
