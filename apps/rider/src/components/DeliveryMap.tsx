import { distanceMetres, estimateMinutes, mapStyleFor } from "@ration/api";
import { Camera, Map as MapLibreMap, Marker, type CameraRef, type StyleSpecification } from "@maplibre/maplibre-react-native";
import { useEffect, useMemo, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Typography } from "@/components/ui";
import { colors, radius, spacing } from "@/constants/theme";
import { env } from "@/lib/env";
import { useRider } from "@/stores/rider";

/** Destination plus my own position (from the publishing watcher). */
export function DeliveryMap({ destination }: { destination: { lat: number; lng: number } }) {
  const camera = useRef<CameraRef>(null);
  const me = useRider((s) => s.position);
  const mapStyle = useMemo(() => mapStyleFor(env.mapsProvider === "ola" ? "ola" : "osm", env.olaMapsApiKey) as string | StyleSpecification, []);

  useEffect(() => {
    if (!me) return;
    camera.current?.fitBounds([Math.min(me.lng, destination.lng), Math.min(me.lat, destination.lat), Math.max(me.lng, destination.lng), Math.max(me.lat, destination.lat)], { padding: { top: 60, right: 60, bottom: 60, left: 60 }, duration: 600 });
  }, [me, destination.lat, destination.lng]);

  const metres = me ? distanceMetres(me, destination) : null;
  return (
    <View style={styles.wrap}>
      <MapLibreMap style={styles.map} mapStyle={mapStyle} logo={false} attribution attributionPosition={{ bottom: 6, left: 6 }}>
        <Camera ref={camera} initialViewState={{ center: [destination.lng, destination.lat], zoom: 14 }} />
        <Marker id="destination" lngLat={[destination.lng, destination.lat]} anchor="bottom"><View style={styles.pin} /></Marker>
        {me ? <Marker id="me" lngLat={[me.lng, me.lat]} anchor="center"><View style={styles.me}><Text style={{ fontSize: 16 }}>🛵</Text></View></Marker> : null}
      </MapLibreMap>
      <View style={styles.footer}>
        <Typography variant="label">{metres !== null ? `${(metres / 1000).toFixed(1)} km · about ${estimateMinutes(metres)} min` : "Waiting for your location…"}</Typography>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: "hidden", backgroundColor: colors.surface },
  map: { height: 240, backgroundColor: colors.primaryTint },
  footer: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  pin: { width: 26, height: 26, borderRadius: 13, borderBottomRightRadius: 0, transform: [{ rotate: "45deg" }], backgroundColor: colors.primary, borderWidth: 2, borderColor: colors.surface },
  me: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.accent, borderWidth: 3, borderColor: colors.surface, alignItems: "center", justifyContent: "center" },
});
