"use client";

import { createTrackingApi, distanceMetres, estimateMinutes, mapStyleFor, type RiderPosition } from "@ration/api";
import { LngLatBounds, Map as MLMap, Marker, NavigationControl, getVersion, setWorkerUrl } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";

import { env } from "@/lib/env";
import { supabase } from "@/lib/supabase";

import "maplibre-gl/dist/maplibre-gl.css";

interface Props {
  riderId: string | null;
  destination: { lat: number; lng: number };
  store?: { lat: number; lng: number; name: string } | null;
  heightClass?: string;
}

const pin = (color: string, label: string) => {
  const el = document.createElement("div");
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", label);
  el.style.cssText = `width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:2px solid #fff;box-shadow:0 2px 6px rgba(18,60,45,.35)`;
  return el;
};

const riderEl = () => {
  const el = document.createElement("div");
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", "Delivery partner");
  el.style.cssText = "width:36px;height:36px;border-radius:50%;background:#D9A441;border:3px solid #fff;box-shadow:0 2px 8px rgba(18,60,45,.4);display:grid;place-items:center;font-size:18px";
  el.textContent = "🛵";
  return el;
};

// The worker is copied into /public by scripts/copy-maplibre-worker.mjs; the version query
// stops a browser reusing a worker cached from an older MapLibre release.
setWorkerUrl(`/maplibre/maplibre-gl-worker.mjs?v=${getVersion()}`);

/** Live delivery map: store, destination and the rider's position streamed over realtime. */
export function LiveMap({ riderId, destination, store, heightClass = "h-72" }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const riderMarker = useRef<Marker | null>(null);
  const [rider, setRider] = useState<RiderPosition | null>(null);

  useEffect(() => {
    if (!container.current || map.current) return;
    const m = new MLMap({
      container: container.current,
      style: mapStyleFor(env.mapsProvider, env.olaMapsApiKey) as never,
      center: [destination.lng, destination.lat],
      zoom: 14,
      attributionControl: { compact: true },
    });
    m.addControl(new NavigationControl({ showCompass: false }), "top-right");
    new Marker({ element: pin("#20543B", "Delivery address") }).setLngLat([destination.lng, destination.lat]).addTo(m);
    if (store) new Marker({ element: pin("#3D805A", store.name) }).setLngLat([store.lng, store.lat]).addTo(m);
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
      riderMarker.current = null;
    };
    // The map is created once; destination/store are fixed for an order.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!riderId) return;
    const tracking = createTrackingApi(supabase);
    tracking.getRiderPosition(riderId).then((p) => p && setRider(p)).catch(() => undefined);
    return tracking.subscribeRider(riderId, setRider);
  }, [riderId]);

  useEffect(() => {
    const m = map.current;
    if (!m || !rider) return;
    if (!riderMarker.current) riderMarker.current = new Marker({ element: riderEl() }).setLngLat([rider.lng, rider.lat]).addTo(m);
    else riderMarker.current.setLngLat([rider.lng, rider.lat]);
    const bounds = new LngLatBounds([rider.lng, rider.lat], [rider.lng, rider.lat]).extend([destination.lng, destination.lat]);
    m.fitBounds(bounds, { padding: 60, maxZoom: 16, duration: 800 });
  }, [rider, destination.lat, destination.lng]);

  const metres = rider ? distanceMetres(rider, destination) : null;

  return (
    <div className="overflow-hidden rounded-card border border-border">
      <div ref={container} className={`${heightClass} w-full bg-primary-tint`} />
      <div className="flex items-center justify-between bg-surface px-3 py-2 text-sm">
        {rider && metres !== null ? (
          <>
            <span><b>{(metres / 1000).toFixed(1)} km</b> away · about {estimateMinutes(metres)} min</span>
            <span className="text-xs text-muted">updated {new Date(rider.updated_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</span>
          </>
        ) : riderId ? (
          <span className="text-muted">Waiting for the delivery partner location…</span>
        ) : (
          <span className="text-muted">Live tracking starts once a delivery partner picks up your order.</span>
        )}
      </div>
    </div>
  );
}
