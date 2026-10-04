"use client";

export default function SyncResultsModal({ logs, onClose }: { logs: string[] | null; onClose: () => void }) {
  if (logs === null) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full p-6 flex flex-col max-h-[80vh]">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Sync Results</h3>
        <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 p-3 rounded text-xs font-mono text-gray-700 dark:text-gray-300 whitespace-pre-wrap tracking-tight">
          {logs.join("\n")}
        </div>
        <div className="mt-4 flex justify-end">
          <button onClick={onClose} className="px-6 py-2 bg-indigo-600 text-white font-medium rounded hover:bg-indigo-700 transition">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
