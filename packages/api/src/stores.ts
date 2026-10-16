import type { Client } from "./client";

export interface ServingStore {
  id: string;
  name: string;
  code: string;
  is_open: boolean;
  promised_minutes: number;
  min_order_amount: number;
  delivery_fee: number;
  free_delivery_above: number;
  opens_at: string;
  closes_at: string;
  distance_m: number;
}

export const createStoresApi = (client: Client) => ({
  /** The dark store serving a point, or null when the location is outside every service area. */
  findServing: async (lat: number, lng: number): Promise<ServingStore | null> => {
    const { data, error } = await client.rpc("serving_store", { lat, lng });
    if (error) throw error;
    const rows = (data ?? []) as ServingStore[];
    return rows[0] ?? null;
  },
});
