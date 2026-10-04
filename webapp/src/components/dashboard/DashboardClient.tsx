"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { DashboardDataDTO, ShowDTO, ShowEditableField } from "@/types/dto";
import type { SyncOrphan } from "@/lib/sync/syncShows";
import ArtistTabs from "@/components/dashboard/ArtistTabs";
import TimeFilterDropdown from "@/components/dashboard/TimeFilterDropdown";
import LogsDropdown from "@/components/dashboard/LogsDropdown";
import ShowsTable from "@/components/dashboard/ShowsTable";
import ChecklistDrawer from "@/components/dashboard/ChecklistDrawer";
import SyncResultsModal from "@/components/dashboard/SyncResultsModal";
import OrphanModal from "@/components/dashboard/OrphanModal";

const MapView = dynamic(() => import("@/components/dashboard/MapView"), { ssr: false });

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function DashboardClient({
  userName,
  signOutAction,
}: {
  userName: string;
  signOutAction: () => Promise<void>;
}) {
  const [data, setData] = useState<DashboardDataDTO | null>(null);
  const [status, setStatus] = useState<{ message: string; error: boolean }>({ message: "Initializing...", error: false });
  const [selectedArtist, setSelectedArtist] = useState("All");
  const [timeFilters, setTimeFilters] = useState<Set<string>>(new Set(["future"]));
  const [checklistShow, setChecklistShow] = useState<ShowDTO | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncLogs, setSyncLogs] = useState<string[] | null>(null);
  const [orphans, setOrphans] = useState<SyncOrphan[] | null>(null);
  const [isDark, setIsDark] = useState(true);

  const loadData = useCallback(async () => {
    setStatus({ message: "Fetching data...", error: false });
    try {
      const res = await fetch("/api/shows");
      if (!res.ok) throw new Error(`Server error (${res.status})`);
      const json: DashboardDataDTO = await res.json();
      setData(json);
      setStatus({ message: "Ready", error: false });
    } catch (e) {
      setStatus({ message: (e as Error).message, error: true });
    }
  }, []);

  useEffect(() => {
    loadData();
    const stored = typeof window !== "undefined" ? window.localStorage.getItem("theme") : null;
    if (stored === "light") {
      setIsDark(false);
      document.documentElement.classList.remove("dark");
    }
  }, [loadData]);

  const toggleTheme = () => {
    setIsDark((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle("dark", next);
      window.localStorage.setItem("theme", next ? "dark" : "light");
      return next;
    });
  };

  const filteredShows = useMemo(() => {
    if (!data) return [];
    const today = todayStr();
    return data.shows.filter((show) => {
      if (selectedArtist !== "All" && !show.artists.includes(selectedArtist)) return false;
      const isFuture = show.date >= today;
      if (timeFilters.has("future") && isFuture) return true;
      if (timeFilters.has("past") && !isFuture) return true;
      return false;
    });
  }, [data, selectedArtist, timeFilters]);

  const visibleArtistTabs = useMemo(
    () => (data?.artistOptions ?? []).filter((a) => a !== "Reznik"),
    [data]
  );

  const updateShowField = useCallback(
    async (showId: string, field: ShowEditableField, value: string | string[] | number) => {
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          shows: prev.shows.map((s) => {
            if (s.id !== showId) return s;
            if (field === "status") return { ...s, status: String(value) };
            if (field === "capacity") return { ...s, capacity: value === "" ? null : Number(value) };
            if (field === "stageTime" || field === "setpiece") return { ...s, [field]: value };
            if (field === "artists" || field === "ld" || field === "lo" || field === "pm" || field === "se") {
              return { ...s, [field]: value as string[] };
            }
            return s;
          }),
        };
      });
      await fetch(`/api/shows/${showId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field, value }),
      });
    },
    []
  );

  const copyEmail = useCallback(
    async (show: ShowDTO) => {
      if (!data) return;
      if (!show.folderUrl) {
        alert("No folder URL found.");
        return;
      }
      let template: string | null = null;
      const lowerArtists = show.artists.join(" ").toLowerCase();
      for (const [key, msg] of Object.entries(data.emailTemplates)) {
        if (lowerArtists.includes(key.toLowerCase())) {
          template = msg;
          break;
        }
      }
      if (!template) template = data.emailTemplates["default"] || "Please upload...\n\n[FOLDER_LINK]";

      const evtDate = new Date(show.date);
      const deadlineDate = new Date(evtDate);
      deadlineDate.setDate(evtDate.getDate() - 90);
      const deadlineStr = deadlineDate.toISOString().slice(0, 10);
      const finalMsg = template.replace("[FOLDER_LINK]", show.folderUrl).replace("[DEADLINE]", deadlineStr);

      try {
        await navigator.clipboard.writeText(finalMsg);
      } catch {
        // Clipboard API can fail without a user gesture / in insecure contexts; ignore.
      }
    },
    [data]
  );

  const triggerSync = async () => {
    setSyncing(true);
    setStatus({ message: "Syncing...", error: false });
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Sync failed");
      setStatus({ message: "Ready", error: false });
      setSyncLogs(result.logs ?? []);
      if (result.orphans && result.orphans.length > 0) setOrphans(result.orphans);
    } catch (e) {
      setStatus({ message: "Sync Error", error: true });
      alert(`Sync Error: ${(e as Error).message}`);
    } finally {
      setSyncing(false);
    }
  };

  const closeSyncModal = () => {
    setSyncLogs(null);
    loadData();
  };

  const closeOrphanModal = () => {
    setOrphans(null);
    loadData();
  };

  const deleteOrphans = async (ids: string[]) => {
    setOrphans(null);
    if (ids.length === 0) {
      loadData();
      return;
    }
    setStatus({ message: "Deleting cancelled shows...", error: false });
    try {
      await fetch("/api/shows/bulk-delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      setStatus({ message: "Ready", error: false });
    } catch (e) {
      alert(`Error deleting shows: ${(e as Error).message}`);
    } finally {
      loadData();
    }
  };

  const handleCountsChange = (showId: string, checked: number, total: number) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        shows: prev.shows.map((s) => (s.id === showId ? { ...s, checklistChecked: checked, checklistTotal: total } : s)),
      };
    });
  };

  return (
    <>
      <div className="w-full shadow-md border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex flex-col xl:flex-row items-center justify-between p-4 gap-6">
          <div className="text-center xl:text-left min-w-max">
            <h1 className="text-2xl font-bold tracking-tight">Production Dashboard</h1>
            <p className={`text-xs mt-1 font-mono ${status.error ? "text-red-600 font-bold" : "text-green-600"}`}>
              {status.message}
            </p>
          </div>

          <ArtistTabs artists={visibleArtistTabs} selected={selectedArtist} onSelect={setSelectedArtist} />

          <div className="flex flex-wrap justify-center xl:justify-end gap-2 items-center min-w-max">
            <LogsDropdown />
            <TimeFilterDropdown selected={timeFilters} onChange={setTimeFilters} />
            <div className="h-6 w-px bg-gray-300 dark:bg-gray-600 mx-2 hidden xl:block" />
            <button
              onClick={triggerSync}
              disabled={syncing}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium shadow transition"
            >
              {syncing ? "Syncing..." : "Sync"}
            </button>
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200"
            >
              {isDark ? "Dark" : "Light"}
            </button>
            <span className="text-xs text-gray-500 hidden xl:inline">{userName}</span>
            <a
              href="/dashboard/settings"
              className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition text-xs font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200"
            >
              Settings
            </a>
            <form action={signOutAction}>
              <button
                type="submit"
                className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition text-xs font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
        <MapView shows={filteredShows} onOpenChecklist={setChecklistShow} />
      </div>

      <div className="w-full p-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            Shows List
            <span className="text-xs font-normal text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
              {data ? filteredShows.length : "..."}
            </span>
          </h2>
        </div>
        {data ? (
          <ShowsTable
            shows={filteredShows}
            crewOptions={data.crewOptions}
            artistOptions={data.artistOptions}
            onUpdateField={updateShowField}
            onOpenChecklist={setChecklistShow}
            onCopyEmail={copyEmail}
          />
        ) : (
          <div className="px-4 py-8 text-center text-gray-500">Loading data...</div>
        )}
      </div>

      <ChecklistDrawer
        showId={checklistShow?.id ?? null}
        showDate={checklistShow?.date ?? null}
        onClose={() => setChecklistShow(null)}
        onCountsChange={handleCountsChange}
      />
      <SyncResultsModal logs={syncLogs} onClose={closeSyncModal} />
      <OrphanModal orphans={orphans} onKeep={closeOrphanModal} onDelete={deleteOrphans} />
    </>
  );
}
