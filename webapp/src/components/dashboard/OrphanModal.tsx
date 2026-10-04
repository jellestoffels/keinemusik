"use client";

import { useEffect, useState } from "react";
import type { SyncOrphan } from "@/lib/sync/syncShows";

export default function OrphanModal({
  orphans,
  onKeep,
  onDelete,
}: {
  orphans: SyncOrphan[] | null;
  onKeep: () => void;
  onDelete: (ids: string[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSelected(new Set((orphans ?? []).map((o) => o.showId)));
  }, [orphans]);

  if (orphans === null) return null;

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Missing Shows Detected</h3>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          The following upcoming shows are in the database but are missing from the calendar feeds. They may have been
          cancelled or rescheduled. Do you want to remove them from the dashboard?
        </p>
        <ul className="max-h-60 overflow-y-auto mb-4 border border-gray-200 dark:border-gray-700 rounded divide-y divide-gray-200 dark:divide-gray-700">
          {orphans.map((o) => (
            <li key={o.showId} className="p-3 flex items-center gap-3">
              <input
                type="checkbox"
                checked={selected.has(o.showId)}
                onChange={() => toggle(o.showId)}
                className="h-4 w-4 text-red-600 rounded border-gray-300 cursor-pointer"
              />
              <label className="text-sm text-gray-800 dark:text-gray-200 cursor-pointer w-full">
                <strong>{o.date}</strong> — {o.name}
              </label>
            </li>
          ))}
        </ul>
        <div className="flex justify-end gap-3">
          <button
            onClick={onKeep}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition"
          >
            Keep Them
          </button>
          <button
            onClick={() => onDelete(Array.from(selected))}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded transition shadow"
          >
            Delete Selected
          </button>
        </div>
      </div>
    </div>
  );
}
