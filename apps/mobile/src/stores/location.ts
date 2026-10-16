import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { Address } from "@/lib/api/addresses";
import { findServingStore, type ServingStore } from "@/lib/api/stores";
import { getDevicePosition, maps, type ResolvedAddress } from "@/lib/maps";

export interface DeliveryLocation extends ResolvedAddress {
  /** Set when the location is one of the user's saved addresses. */
  addressId?: string;
  addressLabel?: Address["label"];
}

interface LocationState {
  location: DeliveryLocation | null;
  store: ServingStore | null;
  /** idle: nothing chosen yet; resolving: looking up store; ready; unserviceable; error */
  status: "idle" | "resolving" | "ready" | "unserviceable" | "error";
  error: string | null;
  setLocation: (location: DeliveryLocation) => Promise<void>;
  selectSavedAddress: (address: Address) => Promise<void>;
  detectLocation: () => Promise<boolean>;
  refreshStore: () => Promise<void>;
  clear: () => void;
}

export const useLocation = create<LocationState>()(
  persist(
    (set, get) => ({
      location: null,
      store: null,
      status: "idle",
      error: null,

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
        try {
          const point = await getDevicePosition();
          if (!point) {
            set({ status: get().location ? "ready" : "idle", error: "Location permission was not granted" });
            return false;
          }
          const resolved = await maps.reverseGeocode(point);
          await get().setLocation(resolved);
          return true;
        } catch (e) {
          set({ status: "error", error: e instanceof Error ? e.message : "Could not get your location" });
          return false;
        }
      },

      refreshStore: async () => {
        const loc = get().location;
        if (!loc) return;
        try {
          const store = await findServingStore(loc.lat, loc.lng);
          set({ store, status: store ? "ready" : "unserviceable" });
        } catch (e) {
          set({ status: "error", error: e instanceof Error ? e.message : "Could not check serviceability" });
        }
      },

      clear: () => set({ location: null, store: null, status: "idle", error: null }),
    }),
    {
      name: "ration.location",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ location: s.location, store: s.store, status: s.status === "ready" || s.status === "unserviceable" ? s.status : "idle" }),
    },
  ),
);
