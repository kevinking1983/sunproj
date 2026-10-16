import type { Client } from "./client";

export interface RiderPosition {
  rider_id: string;
  lat: number;
  lng: number;
  heading: number | null;
  updated_at: string;
}

/**
 * Live rider position for an order. RLS only returns a rider's row to the customer whose
 * active order (picked_up / out_for_delivery) that rider carries, to staff, or to the rider.
 */
export const createTrackingApi = (client: Client) => ({
  getRiderPosition: async (riderId: string): Promise<RiderPosition | null> => {
    const { data, error } = await client.from("rider_locations").select("rider_id, lat, lng, heading, updated_at").eq("rider_id", riderId).maybeSingle();
    if (error) throw error;
    return (data as RiderPosition | null) ?? null;
  },

  /** Streams position updates. Returns an unsubscribe function. */
  subscribeRider: (riderId: string, onPosition: (p: RiderPosition) => void): (() => void) => {
    const channel = client
      .channel(`rider-${riderId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rider_locations", filter: `rider_id=eq.${riderId}` }, (payload) => {
        const row = payload.new as Partial<RiderPosition> | undefined;
        if (row && typeof row.lat === "number" && typeof row.lng === "number") {
          onPosition({ rider_id: riderId, lat: row.lat, lng: row.lng, heading: row.heading ?? null, updated_at: row.updated_at ?? new Date().toISOString() });
        }
      })
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  },

  /** Rider side: publish own position (requires the rider role). */
  publishPosition: async (lat: number, lng: number, heading?: number | null): Promise<void> => {
    const { error } = await client.rpc("rider_update_location", { p_lat: lat, p_lng: lng, p_heading: heading ?? undefined });
    if (error) throw error;
  },
});

/** Haversine distance in metres. */
export const distanceMetres = (a: { lat: number; lng: number }, b: { lat: number; lng: number }): number => {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

/** Rough ETA for a two-wheeler in city traffic (~18 km/h) plus a minute to hand over. */
export const estimateMinutes = (metres: number): number => Math.max(1, Math.round(metres / 300) + 1);
