import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export const queryKeys = {
  profile: (userId: string) => ["profile", userId] as const,
  addresses: (userId: string) => ["addresses", userId] as const,
  servingStore: (lat: number, lng: number) => ["serving-store", lat.toFixed(4), lng.toFixed(4)] as const,
  categories: ["categories"] as const,
  banners: ["banners"] as const,
  products: (storeId: string, categoryId?: string) => ["products", storeId, categoryId ?? "all"] as const,
  product: (slug: string) => ["product", slug] as const,
  search: (storeId: string, q: string) => ["search", storeId, q] as const,
  orders: (userId: string) => ["orders", userId] as const,
  order: (orderId: string) => ["order", orderId] as const,
  wallet: (userId: string) => ["wallet", userId] as const,
  coupons: ["coupons"] as const,
};
