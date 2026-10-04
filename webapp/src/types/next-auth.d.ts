import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    hasDriveAccess?: boolean;
    user?: DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    accessTokenExpires?: number;
    hasDriveAccess?: boolean;
    driveAccessCheckedAt?: number;
  }
}
