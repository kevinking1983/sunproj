"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { useAuth } from "@/stores/auth";
import { useLocation } from "@/stores/location";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false } } }));
  const initialise = useAuth((s) => s.initialise);
  const refreshStore = useLocation((s) => s.refreshStore);
  const hydrated = useLocation((s) => s.hydrated);

  useEffect(() => initialise(), [initialise]);
  useEffect(() => {
    if (hydrated) void refreshStore();
  }, [hydrated, refreshStore]);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
