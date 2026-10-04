# Deployment Guide

Production deployment of the Show Production Dashboard: Next.js (App Router) on Vercel,
Postgres on Neon or Supabase, Google Drive/Calendar integrations via a service account,
and Google sign-in gated by Drive folder access.

## 1. Prerequisites

- A Google Cloud project with billing/API access.
- A Neon or Supabase Postgres project.
- A Vercel account with this repo connected (root directory: `webapp/`).

## 2. Google Cloud OAuth setup (sign-in)

1. Go to **APIs & Services > OAuth consent screen**. Configure an Internal or External
   consent screen (Internal if your org uses Google Workspace and all users are in it).
2. Enable APIs: **Google Drive API** and **Google Calendar API**
   (APIs & Services > Library).
3. Go to **APIs & Services > Credentials > Create Credentials > OAuth client ID**.
   - Application type: **Web application**.
   - Authorized redirect URIs:
     - `http://localhost:3000/api/auth/callback/google` (local dev)
     - `https://<your-vercel-domain>/api/auth/callback/google` (production)
   - Copy the **Client ID** and **Client secret** -> `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
4. The app requests the `drive.readonly` scope at sign-in (see `src/auth.ts`) so it can
   verify, per-user, that the signed-in account has read access to the gating Drive folder.

## 3. Google service account (Drive writes + Calendar API reads)

The service account is a *separate* identity from the OAuth client above. It performs
server-initiated Drive writes (creating show folders) and, optionally, reads from Google
Calendar directly via the API.

1. **IAM & Admin > Service Accounts > Create Service Account.**
2. Create a JSON key for it (Keys tab > Add key > JSON). From the downloaded file:
   - `client_email` -> `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` -> `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (keep the `\n` escapes as-is;
     paste the value verbatim into the Vercel env var / `.env` file, don't unescape it)
3. **Share the Drive parent folder** (the one you'll set as `GOOGLE_DRIVE_FOLDER_ID`) with
   the service account's `client_email`, with **Editor/Content manager** access, so it can
   create subfolders. If the folder lives in a **Shared Drive**, add the service account as
   a member of that Shared Drive instead (service accounts have no personal Drive storage
   and can only write into folders explicitly shared with them or Shared Drives).
4. If you plan to use the optional Calendar-API sync path (`IcalFeed.calendarId`), also
   share the relevant Google Calendar with the service account's email (Settings and
   sharing > Share with specific people).

## 4. Drive folder access control

`GOOGLE_DRIVE_FOLDER_ID` is the folder used two ways:

- **Access gate:** every signed-in user must have at least *read* access to this folder
  (checked server-side in `src/auth.ts` via the Drive API using the user's own OAuth
  token). Users without access are redirected to `/access-denied`.
- **Shows root:** per-show folders are created under
  `GOOGLE_DRIVE_FOLDER_ID/<GOOGLE_DRIVE_SHOWS_PATH>` (default `1 - Shows`), mirroring the
  legacy `[Files]/[Light Design]/Keinemusik/1 - Shows` structure.

To grant a teammate access, share `GOOGLE_DRIVE_FOLDER_ID` (or a parent folder/Shared
Drive) with their Google account at Viewer level or above.

## 5. Database (Neon or Supabase)

1. Create a Postgres project/database.
2. Collect both connection strings:
   - **Neon:** `DATABASE_URL` = pooled connection string (PgBouncer, port with `-pooler`
     in the host); `DIRECT_URL` = the same host **without** `-pooler` (used by Prisma
     Migrate, which needs a direct connection).
   - **Supabase:** `DATABASE_URL` = "Connection pooling" string (Transaction mode, port
     6543); `DIRECT_URL` = "Direct connection" string (port 5432).
3. Set both in `.env` (local) and in Vercel's Environment Variables (production/preview).
4. Apply the schema and seed the legacy CSV data:
   ```bash
   cd webapp
   npm install
   npm run db:migrate   # creates tables locally (prompts for a migration name)
   npm run db:seed      # imports prisma/seed-data/*.csv
   ```
   For production, run `npm run db:deploy` (applies committed migrations, non-interactive)
   instead of `db:migrate`, then `npm run db:seed` once against the production database.

## 6. Environment variables (Vercel)

Copy every key from [`webapp/.env.example`](webapp/.env.example) into Vercel
(**Project > Settings > Environment Variables**), for both **Production** and **Preview**:

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Pooled Postgres connection string |
| `DIRECT_URL` | Direct Postgres connection string (migrations) |
| `AUTH_SECRET` | `npx auth secret` or `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `https://<your-vercel-domain>` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth client from step 2 |
| `GOOGLE_DRIVE_FOLDER_ID` | Drive folder id (from its URL) used for access-gating + show folders |
| `GOOGLE_DRIVE_SHOWS_PATH` | Optional, defaults to `1 - Shows` |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` / `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Service account from step 3 |
| `GOOGLE_MAPS_GEOCODING_API_KEY` | Optional, enables venue geocoding during sync |
| `CRON_SECRET` | Random string; Vercel Cron sends it as `Authorization: Bearer <value>` |

## 7. Scheduled sync (Vercel Cron)

[`webapp/vercel.json`](webapp/vercel.json) defines a cron job hitting `GET /api/sync`
every 6 hours. Vercel automatically sends `Authorization: Bearer $CRON_SECRET` for cron
requests as long as `CRON_SECRET` is set as an environment variable - no extra
configuration needed beyond setting that variable. Adjust the `schedule` (standard cron
syntax, UTC) as needed. The manual "Sync" button in the dashboard calls the same engine
via `POST /api/sync` (requires a signed-in session instead of the cron secret).

## 8. Deploy

1. Push this repo to GitHub/GitLab/Bitbucket and import it in Vercel, setting the
   **Root Directory** to `webapp`.
2. Set all environment variables from step 6.
3. Deploy. Vercel runs `npm run build`, which runs `prisma generate` via the `postinstall`
   script automatically.
4. After the first successful deploy, run migrations + seed against the production
   database from your machine (steps in §5), pointed at the production `DATABASE_URL`.

## 9. Local development

```bash
cd webapp
cp .env.example .env   # fill in values
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Visit `http://localhost:3000` - you'll be redirected to `/signin`, then to
`/access-denied` if your Google account lacks read access to `GOOGLE_DRIVE_FOLDER_ID`.

## 10. Known behavioural notes (ported from the legacy Apps Script)

- Sync merges/de-duplicates shows across feeds using the same date+artist+venue/city
  heuristics as the original `generateSystemId()`/`syncApiData()` (see
  `src/lib/sync/syncShows.ts`). Existing shows with a stale system id are "healed"
  in place rather than duplicated.
- A show is only auto-deleted when its `Status` is set to **Cancelled**; shows that
  simply vanish from a feed are reported as "orphans" for manual confirmation in the
  Sync Results modal (manual sync only - the scheduled cron sync does not report orphans).
- Checklist items are now plain Postgres rows (`ChecklistItem`) seeded from
  `ChecklistTemplateItem` rows at show-creation time, replacing the legacy per-show
  Google Sheet copies. Customize the seeded templates (`default`/`keinemusik`/`duo`/
  per-artist) via Prisma Studio (`npm run db:studio`) once real task lists are available.
