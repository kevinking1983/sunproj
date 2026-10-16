import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 10_000, retry: 1, refetchOnWindowFocus: false } } });

export const queryKeys = {
  summary: ["rider-summary"] as const,
  active: ["rider-active"] as const,
  pool: ["rider-pool"] as const,
  history: ["rider-history"] as const,
  order: (id: string) => ["rider-order", id] as const,
};
