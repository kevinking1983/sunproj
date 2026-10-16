"use client";

import { createAddressesApi, createCatalogApi, createCouponsApi, createOrdersApi, createProfileApi, createStoresApi } from "@ration/api";

import { supabase } from "./supabase";

export const catalogApi = createCatalogApi(supabase);
export const storesApi = createStoresApi(supabase);
export const addressesApi = createAddressesApi(supabase);
export const couponsApi = createCouponsApi(supabase);
export const ordersApi = createOrdersApi(supabase);
export const profileApi = createProfileApi(supabase);

export const queryKeys = {
  profile: (userId: string) => ["profile", userId] as const,
  addresses: (userId: string) => ["addresses", userId] as const,
  categories: ["categories"] as const,
  banners: ["banners"] as const,
  products: (storeId: string, scope = "all") => ["products", storeId, scope] as const,
  product: (storeId: string, slug: string) => ["product", storeId, slug] as const,
  search: (storeId: string, q: string) => ["search", storeId, q] as const,
  orders: (userId: string) => ["orders", userId] as const,
  order: (orderId: string) => ["order", orderId] as const,
  wallet: (userId: string) => ["wallet", userId] as const,
  coupons: ["coupons"] as const,
};
