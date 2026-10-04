import { auth, signOut } from "@/auth";
import DashboardClient from "@/components/dashboard/DashboardClient";

export default async function DashboardPage() {
  const session = await auth();

  return (
    <div className="flex min-h-screen flex-col">
      <DashboardClient
        userName={session?.user?.name ?? session?.user?.email ?? "User"}
        signOutAction={async () => {
          "use server";
          await signOut({ redirectTo: "/signin" });
        }}
      />
    </div>
  );
}
