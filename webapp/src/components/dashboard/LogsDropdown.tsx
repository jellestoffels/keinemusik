"use client";

import { useEffect, useRef, useState } from "react";
import type { LogDTO } from "@/types/dto";

export default function LogsDropdown() {
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<LogDTO[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [open]);

  const openMenu = async () => {
    const next = !open;
    setOpen(next);
    if (next) {
      const res = await fetch("/api/logs");
      if (res.ok) setLogs(await res.json());
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={openMenu}
        title="Recent Logs"
        className="px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-600 transition flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
          />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-[70] overflow-hidden">
          <div className="bg-gray-50 dark:bg-gray-900 px-3 py-2 border-b dark:border-gray-700 font-bold text-xs uppercase tracking-wide">
            Recent Activity
          </div>
          <div className="max-h-64 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
            {logs === null ? (
              <div className="p-3 text-xs text-gray-500 text-center">Loading...</div>
            ) : logs.length === 0 ? (
              <div className="p-3 text-xs text-gray-500 text-center">No logs found.</div>
            ) : (
              logs.map((l) => (
                <div key={l.id} className="px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                  <div className="flex justify-between text-gray-400 mb-0.5">
                    <span>{l.date}</span>
                    <span className="font-semibold text-gray-600 dark:text-gray-300">{l.type}</span>
                  </div>
                  <div className="text-gray-800 dark:text-gray-200">{l.desc}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
