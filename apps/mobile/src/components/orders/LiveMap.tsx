import { createTrackingApi, distanceMetres, estimateMinutes, mapStyleFor, type RiderPosition } from "@ration/api";
import { Camera, Map as MapLibreMap, Marker, type CameraRef, type StyleSpecification } from "@maplibre/maplibre-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Typography } from "@/components/ui";
import { colors, radius, spacing } from "@/constants/theme";
import { env } from "@/lib/env";
import { supabase } from "@/lib/supabase";

interface Props {
  riderId: string | null;
  destination: { lat: number; lng: number };
  store?: { lat: number; lng: number; name: string } | null;
}

function Pin({ color, label }: { color: string; label: string }) {
  return <View accessibilityLabel={label} style={[styles.pin, { backgroundColor: color }]} />;
}

/**
 * Live delivery map (MapLibre, open source): OpenStreetMap tiles in "osm"/"device" mode,
 * Ola Maps vector tiles in "ola" mode. Needs a development build (native module).
 */
export function LiveMap({ riderId, destination, store }: Props) {
  const camera = useRef<CameraRef>(null);
  const [rider, setRider] = useState<RiderPosition | null>(null);
  const mapStyle = useMemo(() => mapStyleFor(env.mapsProvider === "ola" ? "ola" : "osm", env.olaMapsApiKey) as string | StyleSpecification, []);

  useEffect(() => {
    if (!riderId) return;
    const tracking = createTrackingApi(supabase);
    tracking.getRiderPosition(riderId).then((p) => p && setRider(p)).catch(() => undefined);
    return tracking.subscribeRider(riderId, setRider);
  }, [riderId]);

  useEffect(() => {
    if (!rider) return;
    const west = Math.min(rider.lng, destination.lng);
    const east = Math.max(rider.lng, destination.lng);
    const south = Math.min(rider.lat, destination.lat);
    const north = Math.max(rider.lat, destination.lat);
    camera.current?.fitBounds([west, south, east, north], { padding: { top: 60, right: 60, bottom: 60, left: 60 }, duration: 800 });
  }, [rider, destination.lat, destination.lng]);

  const metres = rider ? distanceMetres(rider, destination) : null;

  return (
    <View style={styles.wrap}>
      <MapLibreMap style={styles.map} mapStyle={mapStyle} logo={false} attribution attributionPosition={{ bottom: 6, left: 6 }}>
        <Camera ref={camera} initialViewState={{ center: [destination.lng, destination.lat], zoom: 14 }} />
        <Marker id="destination" lngLat={[destination.lng, destination.lat]} anchor="bottom">
          <Pin color={colors.primary} label="Delivery address" />
        </Marker>
        {store ? (
          <Marker id="store" lngLat={[store.lng, store.lat]} anchor="bottom">
            <Pin color={colors.primaryLight} label={store.name} />
          </Marker>
        ) : null}
        {rider ? (
          <Marker id="rider" lngLat={[rider.lng, rider.lat]} anchor="center">
            <View accessibilityLabel="Delivery partner" style={styles.rider}>
              <Text style={styles.riderIcon}>🛵</Text>
            </View>
          </Marker>
        ) : null}
      </MapLibreMap>
      <View style={styles.footer}>
        {rider && metres !== null ? (
          <>
            <Typography variant="label">
              <Typography variant="label" weight="bold">{(metres / 1000).toFixed(1)} km</Typography> away · about {estimateMinutes(metres)} min
            </Typography>
            <Typography variant="caption" tone="muted">
              updated {new Date(rider.updated_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
            </Typography>
          </>
        ) : (
          <Typography variant="caption" tone="muted">
            {riderId ? "Waiting for the delivery partner location…" : "Live tracking starts once a delivery partner picks up your order."}
          </Typography>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: "hidden", backgroundColor: colors.surface },
  map: { height: 260, backgroundColor: colors.primaryTint },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  pin: { width: 26, height: 26, borderRadius: 13, borderBottomRightRadius: 0, transform: [{ rotate: "45deg" }], borderWidth: 2, borderColor: colors.surface },
  rider: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accent, borderWidth: 3, borderColor: colors.surface, alignItems: "center", justifyContent: "center" },
  riderIcon: { fontSize: 18 },
});
