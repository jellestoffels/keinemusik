import { z } from "zod";

/**
 * Centralised, validated access to process.env. Import this instead of using
 * process.env directly so missing configuration fails fast with a clear error.
 * Only import this module in server-side code (route handlers, server actions, scripts).
 */
const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DIRECT_URL: z.string().optional(),

  AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required"),
  NEXTAUTH_URL: z.string().optional(),

  GOOGLE_CLIENT_ID: z.string().min(1, "GOOGLE_CLIENT_ID is required"),
  GOOGLE_CLIENT_SECRET: z.string().min(1, "GOOGLE_CLIENT_SECRET is required"),

  GOOGLE_DRIVE_FOLDER_ID: z.string().min(1, "GOOGLE_DRIVE_FOLDER_ID is required"),
  GOOGLE_DRIVE_SHOWS_PATH: z.string().default("1 - Shows"),

  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: z.string().optional(),

  GOOGLE_MAPS_GEOCODING_API_KEY: z.string().optional(),

  CRON_SECRET: z.string().optional(),

  CHECKLIST_DEFAULT_TEMPLATE: z.string().default("default"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}
