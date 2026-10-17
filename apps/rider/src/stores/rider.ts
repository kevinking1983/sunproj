import { create } from "zustand";

import { riderApi } from "@/lib/api";
import { currentPosition, startPublishing, stopPublishing } from "@/lib/location";

interface RiderState {
  online: boolean;
  position: { lat: number; lng: number } | null;
  busy: boolean;
  error: string | null;
  setOnline: (online: boolean) => Promise<void>;
  hydrate: (online: boolean) => void;
}

export const useRider = create<RiderState>((set, get) => ({
  online: false,
  position: null,
  busy: false,
  error: null,
  // The server remembers that the partner is online across app restarts; resume sharing
  // location in that case, or the customer map and automatic assignment go stale.
  hydrate: (online) => {
    if (online === get().online) return;
    set({ online });
    if (online) void startPublishing((position) => set({ position })).catch(() => set({ error: "Allow location access to keep receiving deliveries." }));
    else void stopPublishing();
  },
  setOnline: async (online) => {
    set({ busy: true, error: null });
    try {
      if (online) {
        await startPublishing((position) => set({ position }));
        const position = await currentPosition();
        if (!position) throw new Error("LOCATION_PERMISSION");
        await riderApi.setOnline(true, position);
        set({ online: true, position });
      } else {
        await stopPublishing();
        await riderApi.setOnline(false);
        set({ online: false });
      }
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      set({ error: m === "LOCATION_PERMISSION" ? "Allow location access to go online." : m });
    } finally {
      set({ busy: false });
    }
  },
}));
