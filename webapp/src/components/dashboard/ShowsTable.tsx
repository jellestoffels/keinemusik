"use client";

import type { ShowDTO, ShowEditableField } from "@/types/dto";
import MultiSelectCell from "@/components/dashboard/MultiSelectCell";
import StatusSelect from "@/components/dashboard/StatusSelect";

export default function ShowsTable({
  shows,
  crewOptions,
  artistOptions,
  onUpdateField,
  onOpenChecklist,
  onCopyEmail,
}: {
  shows: ShowDTO[];
  crewOptions: Record<string, string[]>;
  artistOptions: string[];
  onUpdateField: (showId: string, field: ShowEditableField, value: string | string[] | number) => void;
  onOpenChecklist: (show: ShowDTO) => void;
  onCopyEmail: (show: ShowDTO) => void;
}) {
  return (
    <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow border dark:border-gray-700 pb-40">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10 shadow-sm">
          <tr>
            {[
              "Date",
              "Artist",
              "Venue",
              "City",
              "Country",
              "Stage Time",
              "Capacity",
              "Setpiece",
              "Files",
              "Actions",
              "Status",
              "Checklist",
              "Light Designer",
              "Light Operator",
              "Production Manager",
              "Sound Engineer",
            ].map((h) => (
              <th
                key={h}
                className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-300 uppercase col-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700 text-sm">
          {shows.length === 0 ? (
            <tr>
              <td colSpan={16} className="text-center py-4 text-gray-500">
                No shows found.
              </td>
            </tr>
          ) : (
            shows.map((show) => {
              const percent = show.checklistTotal > 0 ? (show.checklistChecked / show.checklistTotal) * 100 : 0;
              return (
                <tr
                  key={show.id}
                  className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 transition border-b dark:border-gray-700"
                >
                  <td className="px-4 py-3 align-top font-medium col-nowrap">{show.date}</td>
                  <td className="px-4 py-3 align-top col-wrap">
                    <MultiSelectCell
                      values={show.artists}
                      options={artistOptions}
                      onChange={(v) => onUpdateField(show.id, "artists", v)}
                    />
                  </td>
                  <td className="px-4 py-3 align-top col-nowrap">{show.venue || "-"}</td>
                  <td className="px-4 py-3 align-top col-nowrap">
                    {show.venueUrl ? (
                      <a
                        href={show.venueUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:underline text-indigo-600 dark:text-indigo-400 font-medium"
                      >
                        {show.city}
                      </a>
                    ) : (
                      show.city
                    )}
                  </td>
                  <td className="px-4 py-3 align-top col-nowrap text-gray-600 dark:text-gray-400">{show.country || "-"}</td>
                  <td className="px-4 py-3 align-top col-nowrap">
                    <input
                      type="text"
                      defaultValue={show.stageTime}
                      className="w-28 bg-transparent border-b border-gray-300 dark:border-gray-600 focus:border-indigo-500 outline-none text-sm"
                      onBlur={(e) => onUpdateField(show.id, "stageTime", e.target.value)}
                    />
                  </td>
                  <td className="px-4 py-3 align-top col-nowrap">
                    <input
                      type="number"
                      defaultValue={show.capacity ?? ""}
                      className="w-20 bg-transparent border-b border-gray-300 dark:border-gray-600 focus:border-indigo-500 outline-none text-sm text-center"
                      onBlur={(e) => onUpdateField(show.id, "capacity", e.target.value)}
                    />
                  </td>
                  <td className="px-4 py-3 align-top col-nowrap">
                    <input
                      type="text"
                      defaultValue={show.setpiece}
                      className="w-24 bg-transparent border-b border-gray-300 dark:border-gray-600 focus:border-indigo-500 outline-none text-sm text-center"
                      onBlur={(e) => onUpdateField(show.id, "setpiece", e.target.value)}
                    />
                  </td>
                  <td className="px-4 py-3 align-top text-center col-nowrap">
                    {show.folderUrl ? (
                      <a
                        href={show.folderUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={`px-2 py-1 rounded text-xs font-bold border transition ${
                          show.fileCount === 0
                            ? "text-gray-500 hover:text-gray-700 hover:bg-gray-100 border-gray-300"
                            : "bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200"
                        }`}
                      >
                        {show.fileCount} 📁
                      </a>
                    ) : (
                      <span className="text-gray-400 text-xs">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top text-center col-nowrap">
                    <button
                      onClick={() => onCopyEmail(show)}
                      className="text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700 shadow transition"
                    >
                      Copy Email
                    </button>
                  </td>
                  <td className="px-4 py-3 align-top text-center col-nowrap">
                    <StatusSelect status={show.status} onChange={(v) => onUpdateField(show.id, "status", v)} />
                  </td>
                  <td className="px-4 py-3 align-top w-64">
                    {show.folderUrl === "" && show.checklistTotal === 0 ? (
                      <span className="text-xs text-gray-400 italic">No Checklist</span>
                    ) : (
                      <div
                        className="h-full flex flex-col justify-center cursor-pointer group"
                        onClick={() => onOpenChecklist(show)}
                      >
                        <div className="flex justify-between text-xs mb-1 font-medium text-gray-600 dark:text-gray-300">
                          <span>{Math.round(percent)}%</span>
                          <span>
                            {show.checklistChecked}/{show.checklistTotal}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden shadow-sm hover:ring-2 hover:ring-indigo-400 transition-all">
                          <div
                            className="h-full rounded-full bg-blue-600 transition-all duration-500"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top col-wrap">
                    <MultiSelectCell
                      values={show.ld}
                      options={crewOptions["Light Designer"] ?? []}
                      onChange={(v) => onUpdateField(show.id, "ld", v)}
                    />
                  </td>
                  <td className="px-4 py-3 align-top col-wrap">
                    <MultiSelectCell
                      values={show.lo}
                      options={crewOptions["Light Operator"] ?? []}
                      onChange={(v) => onUpdateField(show.id, "lo", v)}
                    />
                  </td>
                  <td className="px-4 py-3 align-top col-wrap">
                    <MultiSelectCell
                      values={show.pm}
                      options={crewOptions["Production Manager"] ?? []}
                      onChange={(v) => onUpdateField(show.id, "pm", v)}
                    />
                  </td>
                  <td className="px-4 py-3 align-top col-wrap">
                    <MultiSelectCell
                      values={show.se}
                      options={crewOptions["Sound Engineer"] ?? []}
                      onChange={(v) => onUpdateField(show.id, "se", v)}
                    />
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
