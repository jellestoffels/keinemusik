"use client";

export default function ArtistTabs({
  artists,
  selected,
  onSelect,
}: {
  artists: string[];
  selected: string;
  onSelect: (artist: string) => void;
}) {
  const base = "px-4 py-2 rounded-lg text-sm font-medium border shadow-sm transition-all duration-200 whitespace-nowrap";
  const active = "bg-indigo-600 border-indigo-600 text-white ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-gray-900";
  const inactive =
    "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600";

  return (
    <div className="flex-1 flex flex-wrap justify-center gap-2 w-full">
      {["All", ...artists].map((artist) => (
        <button
          key={artist}
          onClick={() => onSelect(artist)}
          className={`${base} ${selected === artist ? active : inactive}`}
        >
          {artist}
        </button>
      ))}
    </div>
  );
}
