import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { userHasDriveFolderAccess } from "@/lib/google/drive";

const DRIVE_ACCESS_RECHECK_MS = 60 * 60 * 1000; // re-verify Drive access at most hourly

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/signin", error: "/signin" },
  providers: [
    Google({
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/drive.readonly",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account?.access_token) {
        token.accessToken = account.access_token;
        token.accessTokenExpires = account.expires_at ? account.expires_at * 1000 : undefined;
      }

      const needsCheck =
        typeof token.hasDriveAccess !== "boolean" ||
        !token.driveAccessCheckedAt ||
        Date.now() - (token.driveAccessCheckedAt as number) > DRIVE_ACCESS_RECHECK_MS;

      if (needsCheck && typeof token.accessToken === "string") {
        token.hasDriveAccess = await userHasDriveFolderAccess(token.accessToken);
        token.driveAccessCheckedAt = Date.now();
      }

      return token;
    },
    async session({ session, token }) {
      session.hasDriveAccess = Boolean(token.hasDriveAccess);
      return session;
    },
  },
});
