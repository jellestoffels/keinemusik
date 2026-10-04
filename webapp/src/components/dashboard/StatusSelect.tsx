"use client";

import { STATUS_COLORS } from "@/lib/constants";

const STATUS_OPTIONS = ["Option", "Confirmed", "To Do", "Waiting", "Done", "Cancelled"];

export default function StatusSelect({ status, onChange }: { status: string; onChange: (value: string) => void }) {
  const colorKey = status === "To Do" ? "ToDo" : status;
  const colorClass = STATUS_COLORS[colorKey] ?? STATUS_COLORS.default;

  return (
    <select
      value={status}
      onChange={(e) => onChange(e.target.value)}
      className={`appearance-none text-center text-xs font-bold py-1 px-3 rounded-full border cursor-pointer outline-none transition-colors ${colorClass}`}
    >
      {STATUS_OPTIONS.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}
