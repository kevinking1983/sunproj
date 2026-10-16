"use client";

import type { Address, ServingStore } from "@ration/api";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { storesApi } from "@/lib/api";
import { getBrowserPosition, maps, type ResolvedAddress } from "@/lib/maps";

export interface DeliveryLocation extends ResolvedAddress {
  addressId?: string;
  addressLabel?: Address["label"];
}

interface LocationState {
  location: DeliveryLocation | null;
  store: ServingStore | null;
  status: "idle" | "resolving" | "ready" | "unserviceable" | "error";
  error: string | null;
  /** True once persisted state has been read on the client (set by markLocationHydrated). */
  hydrated: boolean;
  setLocation: (location: DeliveryLocation) => Promise<void>;
  selectSavedAddress: (address: Address) => Promise<void>;
  detectLocation: () => Promise<boolean>;
  refreshStore: () => Promise<void>;
}

export const useLocation = create<LocationState>()(
  persist<LocationState>(
    (set, get) => ({
      location: null,
      store: null,
      status: "idle",
      error: null,
      hydrated: false,

      setLocation: async (location) => {
        set({ location, status: "resolving", error: null });
        await get().refreshStore();
      },

      selectSavedAddress: async (a) => {
        await get().setLocation({
          lat: a.lat,
          lng: a.lng,
          label: a.label === "other" ? a.line1 : a.label.charAt(0).toUpperCase() + a.label.slice(1),
          line1: [a.line1, a.line2].filter(Boolean).join(", "),
          city: a.city,
          state: a.state,
          pincode: a.pincode,
          addressId: a.id,
          addressLabel: a.label,
        });
      },

      detectLocation: async () => {
        set({ status: "resolving", error: null });
        const point = await getBrowserPosition();
        if (!point) {
          set({ status: get().location ? "ready" : "idle", error: "Location permission was not granted" });
          return false;
        }
        try {
          await get().setLocation(await maps.reverseGeocode(point));
          return true;
        } catch (e) {
          set({ status: "error", error: e instanceof Error ? e.message : "Could not resolve your location" });
          return false;
        }
      },

      refreshStore: async () => {
        const loc = get().location;
        if (!loc) return;
        try {
          const store = await storesApi.findServing(loc.lat, loc.lng);
          set({ store, status: store ? "ready" : "unserviceable" });
        } catch (e) {
          set({ status: "error", error: e instanceof Error ? e.message : "Could not check serviceability" });
        }
      },
    }),
    {
      name: "ration.location",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ location: s.location, store: s.store, status: s.status === "ready" || s.status === "unserviceable" ? s.status : "idle" }) as LocationState,
    },
  ),
);

/**
 * Call from a client effect after mount: flips `hydrated` once localStorage has been read,
 * without causing a server/client markup mismatch.
 */
export const markLocationHydrated = (): (() => void) => {
  if (useLocation.persist.hasHydrated()) useLocation.setState({ hydrated: true });
  return useLocation.persist.onFinishHydration(() => useLocation.setState({ hydrated: true }));
};
