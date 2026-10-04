import { signOut } from "@/auth";

export default function AccessDeniedPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
      <p className="max-w-md text-sm text-gray-600 dark:text-gray-400">
        Your Google account does not have read access to the production Drive
        folder this app is configured for. Ask an administrator to share the
        folder with your account, then sign in again.
      </p>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/signin" });
        }}
      >
        <button
          type="submit"
          className="rounded-lg border border-gray-300 dark:border-gray-600 px-5 py-2.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
