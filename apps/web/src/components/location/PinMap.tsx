"use client";

import { Map as MLMap, NavigationControl } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";

import { mapStyle } from "@/lib/maplibre";
import type { GeoPoint } from "@/lib/maps";

interface Props {
  center: GeoPoint;
  /** Called with the new map centre after the user pans or zooms (not after programmatic moves). */
  onMove: (point: GeoPoint) => void;
}

/** Map with a fixed centre pin: drag the map until the pin sits on the door. */
export function PinMap({ center, onMove }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const onMoveRef = useRef(onMove);
  // Without WebGL the map cannot start; the address can still be confirmed from the text.
  const [unavailable] = useState(() => typeof document !== "undefined" && !document.createElement("canvas").getContext("webgl2") && !document.createElement("canvas").getContext("webgl"));

  useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);

  useEffect(() => {
    if (!container.current || map.current || unavailable) return;
    const m = new MLMap({ container: container.current, style: mapStyle(), center: [center.lng, center.lat], zoom: 17, attributionControl: { compact: true } });
    m.addControl(new NavigationControl({ showCompass: false }), "top-right");
    m.on("moveend", (e) => {
      // Programmatic moves (jumpTo below) carry no originalEvent; only user gestures do.
      if (!("originalEvent" in e) || !e.originalEvent) return;
      const c = m.getCenter();
      onMoveRef.current({ lat: c.lat, lng: c.lng });
    });
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
    // Created once; later centre changes are applied by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const c = m.getCenter();
    if (Math.abs(c.lat - center.lat) > 1e-6 || Math.abs(c.lng - center.lng) > 1e-6) m.jumpTo({ center: [center.lng, center.lat] });
  }, [center.lat, center.lng]);

  if (unavailable) return null;
  return (
    <div className="relative overflow-hidden rounded-xl border border-border">
      <div ref={container} className="h-56 w-full bg-primary-tint" data-testid="pin-map" />
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full">
        <div className="h-8 w-8 rotate-[-45deg] rounded-[50%_50%_50%_0] border-2 border-white bg-primary shadow-md" />
      </div>
      <p className="bg-surface px-3 py-1.5 text-xs text-muted">Drag the map to place the pin exactly on your door.</p>
    </div>
  );
}
