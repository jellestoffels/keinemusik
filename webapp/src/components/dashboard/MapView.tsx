"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import type { ShowDTO } from "@/types/dto";

// Leaflet's default marker icons reference bundler-relative paths that break under Next.js;
// point them at the CDN instead (same assets the legacy Apps Script page used).
const markerIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length === 0) return;
    if (positions.length === 1) {
      map.setView(positions[0], 8);
    } else {
      map.fitBounds(L.latLngBounds(positions).pad(0.1));
    }
  }, [positions, map]);
  return null;
}

export default function MapView({ shows, onOpenChecklist }: { shows: ShowDTO[]; onOpenChecklist: (show: ShowDTO) => void }) {
  const located = useMemo(() => shows.filter((s): s is ShowDTO & { lat: number; lng: number } => s.lat != null && s.lng != null), [shows]);
  const positions = useMemo<[number, number][]>(() => located.map((s) => [s.lat, s.lng]), [located]);

  return (
    <div id="map">
      <MapContainer center={[20, 0]} zoom={2} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
        <TileLayer
          attribution="&copy; OpenStreetMap"
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        <FitBounds positions={positions} />
        {located.map((show) => {
          const crewList = [
            ...show.ld.map((x) => `${x} (LD)`),
            ...show.lo.map((x) => `${x} (LO)`),
            ...show.pm.map((x) => `${x} (PM)`),
            ...show.se.map((x) => `${x} (SE)`),
          ].join(", ");
          return (
            <Marker key={show.id} position={[show.lat, show.lng]} icon={markerIcon}>
              <Popup>
                <div className="space-y-1 min-w-[220px] text-gray-800">
                  <div className="font-bold text-lg">{show.date}</div>
                  <div className="font-semibold text-indigo-600">{show.artists.join(", ")}</div>
                  <div className="text-sm font-medium">
                    {show.venue || "Unknown Venue"} - {show.city}
                  </div>
                  <hr className="my-2 border-gray-300" />
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {show.venueUrl && (
                      <a href={show.venueUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                        Venue
                      </a>
                    )}
                    {show.ticketsLink && (
                      <a href={show.ticketsLink} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                        Tickets
                      </a>
                    )}
                    {show.folderUrl && (
                      <a href={show.folderUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                        Drive
                      </a>
                    )}
                  </div>
                  {show.stageTime && (
                    <div className="text-xs text-gray-600 mt-2">
                      Stage: <strong>{show.stageTime}</strong>
                    </div>
                  )}
                  {show.capacity ? (
                    <div className="text-xs text-gray-600 mt-1">
                      Cap: <strong>{show.capacity}</strong>
                    </div>
                  ) : null}
                  {show.setpiece && (
                    <div className="text-xs text-gray-600 mt-1">
                      Setpiece: <strong>{show.setpiece}</strong>
                    </div>
                  )}
                  {crewList && (
                    <div className="text-xs mt-2 p-1 bg-gray-100 rounded text-gray-700">
                      <strong>Crew:</strong> {crewList}
                    </div>
                  )}
                  <div className="mt-2 text-center">
                    <button
                      onClick={() => onOpenChecklist(show)}
                      className="px-3 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700 transition"
                    >
                      Open Checklist
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
