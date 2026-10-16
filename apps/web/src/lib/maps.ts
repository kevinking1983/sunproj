"use client";

/**
 * Maps provider for the website: Ola Maps when a key is configured, otherwise OpenStreetMap
 * (Nominatim + Photon). The browser Geolocation API supplies the device position.
 */
import { env } from "./env";

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface ResolvedAddress extends GeoPoint {
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

const OSM_HEADERS = { Accept: "application/json" };

type NominatimResult = { lat: string; lon: string; display_name?: string; address?: Record<string, string> };

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
    const res = await fetch(`${env.nominatimUrl}/reverse?format=jsonv2&lat=${point.lat}&lon=${point.lng}&addressdetails=1`, { headers: OSM_HEADERS });
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
      return { id: `osm:${lat},${lng}:${title}`, title, subtitle };
    });
  },
  placeDetails: async (placeId: string): Promise<ResolvedAddress> => {
    const m = placeId.match(/^osm:([-\d.]+),([-\d.]+):/);
    if (!m) throw new Error("Not an OSM place");
    return osm.reverseGeocode({ lat: Number(m[1]), lng: Number(m[2]) });
  },
};

const OLA_BASE = "https://api.olamaps.io";
type OlaComponent = { long_name?: string; types?: string[] };
type OlaResult = { formatted_address?: string; name?: string; address_components?: OlaComponent[]; geometry?: { location?: { lat: number; lng: number } } };
const component = (parts: OlaComponent[] | undefined, type: string) => parts?.find((p) => p.types?.includes(type))?.long_name ?? "";
const olaFetch = async <T>(path: string, params: Record<string, string>): Promise<T> => {
  const url = new URL(path, OLA_BASE);
  Object.entries({ ...params, api_key: env.olaMapsApiKey }).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Maps request failed (${res.status})`);
  return (await res.json()) as T;
};
const fromOla = (r: OlaResult, fallback: GeoPoint): ResolvedAddress => {
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
const ola = {
  reverseGeocode: async (point: GeoPoint): Promise<ResolvedAddress> => {
    const data = await olaFetch<{ results?: OlaResult[] }>("/places/v1/reverse-geocode", { latlng: `${point.lat},${point.lng}` });
    const first = data.results?.[0];
    return first ? fromOla(first, point) : osm.reverseGeocode(point);
  },
  autocomplete: async (query: string, near?: GeoPoint): Promise<PlaceSuggestion[]> => {
    const params: Record<string, string> = { input: query };
    if (near) params.location = `${near.lat},${near.lng}`;
    const data = await olaFetch<{ predictions?: { place_id: string; description?: string; structured_formatting?: { main_text?: string; secondary_text?: string } }[] }>("/places/v1/autocomplete", params);
    return (data.predictions ?? []).map((p) => ({ id: p.place_id, title: p.structured_formatting?.main_text ?? p.description ?? "", subtitle: p.structured_formatting?.secondary_text ?? "" }));
  },
  placeDetails: async (placeId: string): Promise<ResolvedAddress> => {
    const data = await olaFetch<{ result?: OlaResult }>("/places/v1/details", { place_id: placeId });
    if (!data.result?.geometry?.location) throw new Error("Place has no coordinates");
    return fromOla(data.result, data.result.geometry.location);
  },
};

export const maps = {
  reverseGeocode: (p: GeoPoint) => (env.mapsProvider === "ola" && env.olaMapsApiKey ? ola.reverseGeocode(p) : osm.reverseGeocode(p)),
  autocomplete: (q: string, near?: GeoPoint) => (q.trim().length < 3 ? Promise.resolve([]) : env.mapsProvider === "ola" && env.olaMapsApiKey ? ola.autocomplete(q.trim(), near) : osm.autocomplete(q.trim(), near)),
  placeDetails: (id: string) => (id.startsWith("osm:") ? osm.placeDetails(id) : ola.placeDetails(id)),
};

export const getBrowserPosition = (): Promise<GeoPoint | null> =>
  new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  });
