"use client";

import { useEffect, useState } from "react";
import type { ChecklistItemDTO } from "@/types/dto";

export default function ChecklistDrawer({
  showId,
  showDate,
  onClose,
  onCountsChange,
}: {
  showId: string | null;
  showDate: string | null;
  onClose: () => void;
  onCountsChange: (showId: string, checked: number, total: number) => void;
}) {
  const [items, setItems] = useState<ChecklistItemDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!showId) return;
    setItems(null);
    setError(null);
    fetch(`/api/checklist/${showId}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setItems(data);
        else setError(data.error || "Failed to load checklist");
      })
      .catch(() => setError("Failed to load checklist"));
  }, [showId]);

  const toggle = async (item: ChecklistItemDTO) => {
    if (!showId) return;
    const nextChecked = !item.checked;
    setItems((prev) => {
      const next = (prev ?? []).map((i) => (i.id === item.id ? { ...i, checked: nextChecked } : i));
      next.sort((a, b) => {
        if (a.checked !== b.checked) return a.checked ? 1 : -1;
        return b.deadlineDays - a.deadlineDays;
      });
      return next;
    });
    const res = await fetch(`/api/checklist/${showId}/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checked: nextChecked }),
    });
    if (res.ok) {
      const data = await res.json();
      onCountsChange(showId, data.checklistChecked, data.checklistTotal);
    }
  };

  const open = showId !== null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div
        className={`absolute inset-0 bg-black transition-opacity duration-300 ${open ? "opacity-50 pointer-events-auto" : "opacity-0"}`}
        onClick={onClose}
      />
      <div
        className={`absolute top-0 right-0 h-full w-full max-w-md bg-white dark:bg-gray-800 shadow-2xl transform transition-transform duration-300 flex flex-col pointer-events-auto ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <h2 className="text-lg font-bold">Checklist</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {error ? (
            <div className="text-red-500 p-4">Error: {error}</div>
          ) : items === null ? (
            <div className="text-center text-gray-500 mt-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4" />
              Loading items...
            </div>
          ) : items.length === 0 ? (
            <div className="text-gray-500 p-4 text-center">Checklist is empty.</div>
          ) : (
            items.map((item) => {
              const today = new Date();
              const deadlineDate = showDate ? new Date(showDate) : new Date();
              deadlineDate.setDate(deadlineDate.getDate() - item.deadlineDays);
              let statusClass = "border-l-4 border-gray-200 dark:border-gray-600";
              let warning: string | null = null;
              if (!item.checked) {
                const dayDiff = Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                if (today > deadlineDate) {
                  statusClass = "border-l-4 border-red-500 bg-red-50 dark:bg-red-900/20";
                  warning = `Overdue by ${Math.abs(dayDiff)} days`;
                } else if (dayDiff <= 7) {
                  statusClass = "border-l-4 border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20";
                  warning = `Due in ${dayDiff} days`;
                }
              } else {
                statusClass = "border-l-4 border-green-500 opacity-50";
              }
              return (
                <div key={item.id} className={`p-3 mb-3 rounded shadow-sm bg-white dark:bg-gray-700 ${statusClass}`}>
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={() => toggle(item)}
                      className="mt-1 h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <div className="flex-1">
                      <div className="font-bold text-sm text-gray-900 dark:text-gray-100">{item.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.details || item.category || ""}</div>
                      <div className="mt-2 flex justify-between items-center">
                        <span className="text-xs text-gray-400">Deadline: {deadlineDate.toLocaleDateString()}</span>
                        {warning && (
                          <span className={`font-bold text-xs ${today > deadlineDate ? "text-red-600" : "text-yellow-600"}`}>
                            {warning}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
