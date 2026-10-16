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

export const maps = {
  reverseGeocode: async (point: GeoPoint): Promise<ResolvedAddress> => {
    if (!env.olaMapsApiKey) return deviceReverseGeocode(point);
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
    if (!env.olaMapsApiKey || query.trim().length < 3) return [];
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
