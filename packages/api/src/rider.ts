import type { OrderStatus } from "@ration/shared";

import type { Client } from "./client";
import { ORDER_COLUMNS, type Order } from "./orders";

export interface RiderSummary {
  delivered_today: number;
  tips_today: number;
  cod_collected_today: number;
  delivered_total: number;
  is_online: boolean;
}

export const RIDER_NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
  ready: "picked_up",
  picked_up: "out_for_delivery",
  out_for_delivery: "delivered",
};

/** Delivery partner operations. All RPCs require the rider role. */
export const createRiderApi = (client: Client) => ({
  /** Orders assigned to me that are not finished. */
  myActive: async (): Promise<Order[]> => {
    const { data, error } = await client.from("orders").select(ORDER_COLUMNS).in("status", ["ready", "picked_up", "out_for_delivery"]).not("rider_id", "is", null).order("created_at");
    if (error) throw error;
    return (data ?? []) as unknown as Order[];
  },

  /** Unassigned ready orders any rider can claim (RLS limits the view to this set). */
  pool: async (): Promise<Order[]> => {
    const { data, error } = await client.from("orders").select(ORDER_COLUMNS).is("rider_id", null).eq("status", "ready").order("created_at");
    if (error) throw error;
    return (data ?? []) as unknown as Order[];
  },

  history: async (limit = 50): Promise<Order[]> => {
    const { data, error } = await client.from("orders").select(ORDER_COLUMNS).in("status", ["delivered", "cancelled"]).order("created_at", { ascending: false }).limit(limit);
    if (error) throw error;
    return (data ?? []) as unknown as Order[];
  },

  claim: async (orderId: string): Promise<void> => {
    const { error } = await client.rpc("rider_claim_order", { p_order_id: orderId });
    if (error) throw error;
  },

  advance: async (orderId: string, status: OrderStatus, note?: string): Promise<void> => {
    const { error } = await client.rpc("rider_advance_order", { p_order_id: orderId, p_status: status, p_note: note ?? undefined });
    if (error) throw error;
  },

  setOnline: async (online: boolean, position?: { lat: number; lng: number }): Promise<void> => {
    const { error } = await client.rpc("rider_set_online", { p_online: online, p_lat: position?.lat, p_lng: position?.lng });
    if (error) throw error;
  },

  summary: async (): Promise<RiderSummary> => {
    const { data, error } = await client.rpc("rider_summary");
    if (error) throw error;
    return (data as unknown as RiderSummary | null) ?? { delivered_today: 0, tips_today: 0, cod_collected_today: 0, delivered_total: 0, is_online: false };
  },
});

export const describeRiderError = (e: unknown): string => {
  const m = e instanceof Error ? e.message : String(e);
  const map: Record<string, string> = {
    FORBIDDEN: "This account is not a delivery partner account.",
    LOCATION_REQUIRED: "Turn on location to go online.",
    TOO_MANY_ACTIVE: "Finish your current deliveries before taking more.",
    ORDER_ALREADY_TAKEN: "Another partner took this order.",
    INVALID_TRANSITION: "That step is not available yet.",
    ORDER_NOT_FOUND: "This order is no longer assigned to you.",
  };
  return map[m] ?? m;
};
