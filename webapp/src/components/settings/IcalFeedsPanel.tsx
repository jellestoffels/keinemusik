"use client";

import { useEffect, useState } from "react";

interface IcalFeed {
  id: string;
  artist: string;
  url: string;
  calendarId: string | null;
  active: boolean;
}

export default function IcalFeedsPanel() {
  const [feeds, setFeeds] = useState<IcalFeed[] | null>(null);
  const [artist, setArtist] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch("/api/ical-feeds");
    if (res.ok) setFeeds(await res.json());
  };

  useEffect(() => {
    load();
  }, []);

  const addFeed = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/ical-feeds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ artist, url }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to add feed");
      return;
    }
    setArtist("");
    setUrl("");
    load();
  };

  const toggleActive = async (feed: IcalFeed) => {
    await fetch(`/api/ical-feeds/${feed.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !feed.active }),
    });
    load();
  };

  const remove = async (feed: IcalFeed) => {
    if (!confirm(`Remove feed for ${feed.artist}?`)) return;
    await fetch(`/api/ical-feeds/${feed.id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="space-y-6">
      <form onSubmit={addFeed} className="flex flex-col sm:flex-row gap-2">
        <input
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
          placeholder="Artist name"
          required
          className="border border-gray-300 dark:border-gray-600 bg-transparent rounded px-3 py-2 text-sm flex-1"
        />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://.../calendar.ics"
          required
          type="url"
          className="border border-gray-300 dark:border-gray-600 bg-transparent rounded px-3 py-2 text-sm flex-[2]"
        />
        <button type="submit" className="px-4 py-2 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700">
          Add Feed
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-200 dark:divide-gray-700">
        {feeds === null ? (
          <div className="p-4 text-sm text-gray-500">Loading...</div>
        ) : feeds.length === 0 ? (
          <div className="p-4 text-sm text-gray-500">No feeds configured yet.</div>
        ) : (
          feeds.map((feed) => (
            <div key={feed.id} className="p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{feed.artist}</div>
                <div className="text-xs text-gray-500 truncate">{feed.url}</div>
              </div>
              <button
                onClick={() => toggleActive(feed)}
                className={`text-xs px-2 py-1 rounded border ${
                  feed.active
                    ? "bg-green-100 text-green-800 border-green-200"
                    : "bg-gray-100 text-gray-600 border-gray-200"
                }`}
              >
                {feed.active ? "Active" : "Paused"}
              </button>
              <button onClick={() => remove(feed)} className="text-xs px-2 py-1 rounded border border-red-200 text-red-600">
                Remove
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
