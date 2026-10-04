import { JWT, OAuth2Client } from "google-auth-library";
import { getEnv } from "@/lib/env";

/**
 * Google API auth clients. Two distinct identities are used:
 *
 * 1. Service account (JWT) - used for server-initiated Drive writes (creating
 *    show folders, counting files). Must be granted access to
 *    GOOGLE_DRIVE_FOLDER_ID (share the folder/shared-drive with the service
 *    account email, or use domain-wide delegation).
 * 2. The signed-in user's own OAuth access token (from the NextAuth session) -
 *    used only to verify that *that user* has read access to the same Drive
 *    folder, as an access-control gate before granting app access.
 */

let serviceAccountAuth: JWT | null = null;

export function getServiceAccountAuth(): JWT {
  if (serviceAccountAuth) return serviceAccountAuth;

  const env = getEnv();
  if (!env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) {
    throw new Error(
      "Missing GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY. " +
        "These are required for Drive folder creation and Calendar API access."
    );
  }

  serviceAccountAuth = new JWT({
    email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    // Env vars can't contain literal newlines; private keys are stored with \n escapes.
    key: env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/drive", "https://www.googleapis.com/auth/calendar.readonly"],
  });

  return serviceAccountAuth;
}

/** Builds a Drive client authenticated as an end user via their own OAuth access token. */
export function getUserDriveAuth(accessToken: string): OAuth2Client {
  const auth = new OAuth2Client();
  auth.setCredentials({ access_token: accessToken });
  return auth;
}
