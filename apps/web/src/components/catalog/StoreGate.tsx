"use client";

import { Button, Spinner } from "@/components/ui";
import { useLocationModal } from "@/components/location/LocationModal";
import { useLocation } from "@/stores/location";

/** Wraps catalog pages: prompts for a location, explains unserviceable areas, else renders children with the store id. */
export function StoreGate({ children }: { children: (storeId: string) => React.ReactNode }) {
  const { store, status, hydrated } = useLocation();
  const open = useLocationModal((s) => s.open);

  if (!hydrated || status === "resolving") return <div className="py-20 text-center"><Spinner /></div>;
  if (status === "unserviceable") {
    return (
      <div className="py-16 text-center">
        <h2 className="text-xl font-bold">We are not here yet</h2>
        <p className="mx-auto mt-2 max-w-md text-muted">RATION does not deliver to this location right now. Pick another address to keep shopping.</p>
        <Button className="mt-4" onClick={open}>Change location</Button>
      </div>
    );
  }
  if (!store) {
    return (
      <div className="py-16 text-center">
        <h2 className="text-xl font-bold">Where should we deliver?</h2>
        <p className="mx-auto mt-2 max-w-md text-muted">Set your location to see what is in stock at your nearest RATION store.</p>
        <Button className="mt-4" variant="accent" onClick={open}>Set delivery location</Button>
      </div>
    );
  }
  return <>{children(store.id)}</>;
}
