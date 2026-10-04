import IcalFeedsPanel from "@/components/settings/IcalFeedsPanel";

export default function SettingsPage() {
  return (
    <div className="max-w-3xl mx-auto w-full p-6">
      <h1 className="text-2xl font-bold mb-1">Settings</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Manage the public iCal feeds the sync job polls for new/updated shows.
      </p>
      <IcalFeedsPanel />
    </div>
  );
}
