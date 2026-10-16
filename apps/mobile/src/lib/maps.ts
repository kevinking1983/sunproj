/**
 * Maps provider abstraction. Ola Maps is primary (Indian address data, 100k free calls/month);
 * the device geocoder from expo-location is the zero-cost fallback used in development and
 * whenever no Ola key is configured. Keep every maps call behind this module so the provider
 * can be swapped without touching screens.
 *
 * Ola Maps endpoints follow https://maps.olakrutrim.com/docs (verify field names against the live
 * docs when the key is added; the response mapping below is defensive).
 */
import * as Location from "expo-location";

import { env } from "./env";

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface ResolvedAddress extends GeoPoint {
  /** Short line shown in headers, e.g. "Indiranagar, Bengaluru". */
  label: string;
  line1: string;
  city: string;
  state: string;
  pincode: string;
}

export interface PlaceSuggestion {
  id: string;
  title: string;
  subtitle: string;
}

const OLA_BASE = "https://api.olamaps.io";

const olaFetch = async <T>(path: string, params: Record<string, string>): Promise<T> => {
  const url = new URL(path, OLA_BASE);
  Object.entries({ ...params, api_key: env.olaMapsApiKey }).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, { headers: { "X-Request-Id": `ration-${Date.now()}` } });
  if (!res.ok) throw new Error(`Maps request failed (${res.status})`);
  return (await res.json()) as T;
};

type OlaAddressComponent = { long_name?: string; short_name?: string; types?: string[] };
type OlaGeocodeResult = {
  formatted_address?: string;
  name?: string;
  address_components?: OlaAddressComponent[];
  geometry?: { location?: { lat: number; lng: number } };
};

const component = (parts: OlaAddressComponent[] | undefined, type: string) =>
  parts?.find((p) => p.types?.includes(type))?.long_name ?? "";

const fromOla = (r: OlaGeocodeResult, fallback: GeoPoint): ResolvedAddress => {
  const parts = r.address_components;
  const locality = component(parts, "sublocality") || component(parts, "neighborhood") || component(parts, "locality");
  const city = component(parts, "locality") || component(parts, "administrative_area_level_2");
  return {
    lat: r.geometry?.location?.lat ?? fallback.lat,
    lng: r.geometry?.location?.lng ?? fallback.lng,
    label: [locality, city].filter(Boolean).join(", ") || r.name || "Selected location",
    line1: r.formatted_address ?? r.name ?? "",
    city,
    state: component(parts, "administrative_area_level_1"),
    pincode: component(parts, "postal_code"),
  };
};

const deviceReverseGeocode = async (point: GeoPoint): Promise<ResolvedAddress> => {
  const [a] = await Location.reverseGeocodeAsync({ latitude: point.lat, longitude: point.lng });
  const locality = a?.district || a?.subregion || a?.city || "";
  const city = a?.city || a?.subregion || "";
  return {
    ...point,
    label: [locality, city].filter((v, i, arr) => v && arr.indexOf(v) === i).join(", ") || "Selected location",
    line1: [a?.name, a?.street, locality, city].filter(Boolean).join(", "),
    city,
    state: a?.region ?? "",
    pincode: a?.postalCode ?? "",
  };
};

// ---------------------------------------------------------------------------
// OpenStreetMap provider (open-source test stack): Nominatim + Photon.
// Public endpoints are rate limited (1 req/s) and for testing only.
// ---------------------------------------------------------------------------
const OSM_HEADERS = { "User-Agent": "RATION-dev/0.1 (testing)", Accept: "application/json" };

type NominatimResult = {
  lat: string;
  lon: string;
  display_name?: string;
  address?: Record<string, string>;
};

const fromNominatim = (r: NominatimResult): ResolvedAddress => {
  const a = r.address ?? {};
  const locality = a.suburb || a.neighbourhood || a.quarter || a.village || a.town || "";
  const city = a.city || a.town || a.county || a.state_district || "";
  return {
    lat: Number(r.lat),
    lng: Number(r.lon),
    label: [locality, city].filter((v, i, arr) => v && arr.indexOf(v) === i).join(", ") || "Selected location",
    line1: r.display_name ?? "",
    city,
    state: a.state ?? "",
    pincode: a.postcode ?? "",
  };
};

const osm = {
  reverseGeocode: async (point: GeoPoint): Promise<ResolvedAddress> => {
    const url = `${env.nominatimUrl}/reverse?format=jsonv2&lat=${point.lat}&lon=${point.lng}&addressdetails=1`;
    const res = await fetch(url, { headers: OSM_HEADERS });
    if (!res.ok) throw new Error(`Nominatim ${res.status}`);
    return { ...fromNominatim((await res.json()) as NominatimResult), ...point };
  },
  autocomplete: async (query: string, near?: GeoPoint): Promise<PlaceSuggestion[]> => {
    const url = new URL(`${env.photonUrl}/api`);
    url.searchParams.set("q", query);
    url.searchParams.set("limit", "8");
    url.searchParams.set("lang", "en");
    if (near) {
      url.searchParams.set("lat", String(near.lat));
      url.searchParams.set("lon", String(near.lng));
    }
    const res = await fetch(url, { headers: OSM_HEADERS });
    if (!res.ok) throw new Error(`Photon ${res.status}`);
    const data = (await res.json()) as { features?: { geometry: { coordinates: [number, number] }; properties: Record<string, string> }[] };
    return (data.features ?? []).map((f) => {
      const p = f.properties;
      const [lng, lat] = f.geometry.coordinates;
      const title = p.name || p.street || p.city || "Place";
      const subtitle = [p.district, p.city, p.state, p.postcode].filter((v, i, arr) => v && arr.indexOf(v) === i).join(", ");
      // Photon already returns coordinates, so the id carries them for placeDetails.
      return { id: `osm:${lat},${lng}:${title}`, title, subtitle };
    });
  },
  placeDetails: async (placeId: string): Promise<ResolvedAddress> => {
    const m = placeId.match(/^osm:([-\d.]+),([-\d.]+):/);
    if (!m) throw new Error("Not an OSM place");
    const point = { lat: Number(m[1]), lng: Number(m[2]) };
    return osm.reverseGeocode(point);
  },
};

export const maps = {
  reverseGeocode: async (point: GeoPoint): Promise<ResolvedAddress> => {
    if (env.mapsProvider === "osm") return osm.reverseGeocode(point).catch(() => deviceReverseGeocode(point));
    if (env.mapsProvider === "device" || !env.olaMapsApiKey) return deviceReverseGeocode(point);
    try {
      const data = await olaFetch<{ results?: OlaGeocodeResult[] }>("/places/v1/reverse-geocode", {
        latlng: `${point.lat},${point.lng}`,
      });
      const first = data.results?.[0];
      return first ? fromOla(first, point) : deviceReverseGeocode(point);
    } catch {
      return deviceReverseGeocode(point);
    }
  },

  autocomplete: async (query: string, near?: GeoPoint): Promise<PlaceSuggestion[]> => {
    if (query.trim().length < 3) return [];
    if (env.mapsProvider === "osm") return osm.autocomplete(query.trim(), near);
    if (env.mapsProvider === "device" || !env.olaMapsApiKey) return [];
    const params: Record<string, string> = { input: query.trim() };
    if (near) params.location = `${near.lat},${near.lng}`;
    const data = await olaFetch<{
      predictions?: { place_id: string; description?: string; structured_formatting?: { main_text?: string; secondary_text?: string } }[];
    }>("/places/v1/autocomplete", params);
    return (data.predictions ?? []).map((p) => ({
      id: p.place_id,
      title: p.structured_formatting?.main_text ?? p.description ?? "",
      subtitle: p.structured_formatting?.secondary_text ?? "",
    }));
  },

  placeDetails: async (placeId: string): Promise<ResolvedAddress> => {
    if (placeId.startsWith("osm:")) return osm.placeDetails(placeId);
    const data = await olaFetch<{ result?: OlaGeocodeResult }>("/places/v1/details", { place_id: placeId });
    if (!data.result?.geometry?.location) throw new Error("Place has no coordinates");
    return fromOla(data.result, data.result.geometry.location);
  },
};

export const getDevicePosition = async (): Promise<GeoPoint | null> => {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") return null;
  const last = await Location.getLastKnownPositionAsync({ maxAge: 60_000 });
  const pos = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
  return { lat: pos.coords.latitude, lng: pos.coords.longitude };
};
