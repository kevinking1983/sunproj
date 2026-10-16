"use client";

import { createAdminApi, createProfileApi } from "@ration/api";

import { supabase } from "./supabase";

export const admin = createAdminApi(supabase);
export const profileApi = createProfileApi(supabase);

export const qk = {
  dashboard: (storeId: string | null) => ["dashboard", storeId ?? "all"] as const,
  orders: (storeId: string | null, active: boolean) => ["admin-orders", storeId ?? "all", active] as const,
  order: (id: string) => ["admin-order", id] as const,
  stores: ["admin-stores"] as const,
  products: ["admin-products"] as const,
  inventory: (storeId: string) => ["admin-inventory", storeId] as const,
  categories: ["admin-categories"] as const,
  coupons: ["admin-coupons"] as const,
  banners: ["admin-banners"] as const,
  riders: ["admin-riders"] as const,
  customers: ["admin-customers"] as const,
};

export const describeError = (e: unknown): string => {
  const m = e instanceof Error ? e.message : String(e);
  const map: Record<string, string> = {
    FORBIDDEN: "You do not have permission to do that.",
    INVALID_TRANSITION: "That status change is not allowed.",
    NOT_A_RIDER: "That user is not a rider.",
    LAST_ADMIN: "There must be at least one admin.",
    ORDER_NOT_CANCELLABLE: "This order can no longer be cancelled.",
  };
  return map[m] ?? m;
};
