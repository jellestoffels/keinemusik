import { getEnv } from "@/lib/env";

/**
 * Best-effort venue geocoding via the Google Maps Geocoding HTTP API, ported
 * from the legacy `Maps.newGeocoder()` call in `syncApiData()`. Optional:
 * returns null when GOOGLE_MAPS_GEOCODING_API_KEY is not configured or the
 * lookup fails, matching the legacy try/catch-and-ignore behaviour.
 */
export async function geocodeVenue(
  venue: string | undefined,
  city: string | undefined,
  country: string | undefined
): Promise<{ lat: number; lng: number } | null> {
  const env = getEnv();
  if (!env.GOOGLE_MAPS_GEOCODING_API_KEY) return null;
  if (!city || !country) return null;

  const address = [venue, city, country].filter(Boolean).join(" ");
  try {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", address);
    url.searchParams.set("key", env.GOOGLE_MAPS_GEOCODING_API_KEY);

    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();
    if (data.status === "OK" && data.results?.[0]?.geometry?.location) {
      const { lat, lng } = data.results[0].geometry.location;
      return { lat, lng };
    }
    return null;
  } catch {
    return null;
  }
}
