import { signIn } from "@/auth";

export const dynamic = "force-dynamic";

export default function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Show Production Dashboard</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Sign in with your Keinemusik Google account to continue.
        </p>
      </div>
      <form
        action={async () => {
          "use server";
          const { callbackUrl } = await searchParams;
          await signIn("google", { redirectTo: callbackUrl || "/dashboard" });
        }}
      >
        <button
          type="submit"
          className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow hover:bg-indigo-700 transition"
        >
          Sign in with Google
        </button>
      </form>
    </div>
  );
}
