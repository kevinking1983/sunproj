import { mapStyleFor } from "@ration/api";
import { Camera, Map as MapLibreMap, type StyleSpecification } from "@maplibre/maplibre-react-native";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { Typography } from "@/components/ui";
import { colors, radius, spacing } from "@/constants/theme";
import { env } from "@/lib/env";
import type { GeoPoint } from "@/lib/maps";

export interface PinMapProps {
  center: GeoPoint;
  /** Called with the new map centre after the user pans or zooms the map. */
  onMove: (point: GeoPoint) => void;
}

/**
 * Map with a fixed centre pin: the user drags the map until the pin sits on their door.
 * Needs a development build (MapLibre is a native module); see PinMapOrNothing.
 */
export function PinMap({ center, onMove }: PinMapProps) {
  const mapStyle = useMemo(() => mapStyleFor(env.mapsProvider === "ola" ? "ola" : "osm", env.olaMapsApiKey) as string | StyleSpecification, []);
  return (
    <View style={styles.wrap}>
      <View style={styles.mapBox}>
        <MapLibreMap
          style={styles.map}
          mapStyle={mapStyle}
          logo={false}
          attribution
          attributionPosition={{ bottom: 6, left: 6 }}
          onRegionDidChange={(e) => {
            // Only react to the user's own gestures, not to the initial camera placement.
            if (!e.nativeEvent.userInteraction) return;
            const [lng, lat] = e.nativeEvent.center;
            onMove({ lat, lng });
          }}
        >
          <Camera initialViewState={{ center: [center.lng, center.lat], zoom: 17 }} />
        </MapLibreMap>
        <View pointerEvents="none" style={styles.pinHolder}>
          <View accessibilityLabel="Delivery pin" style={styles.pin} />
        </View>
      </View>
      <Typography variant="caption" tone="muted" style={styles.hint}>Drag the map to place the pin exactly on your door.</Typography>
    </View>
  );
}

const PIN = 30;
const styles = StyleSheet.create({
  wrap: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: "hidden", backgroundColor: colors.surface },
  mapBox: { height: 240 },
  map: { flex: 1, backgroundColor: colors.primaryTint },
  // The pin's tip sits on the exact centre of the map.
  pinHolder: { position: "absolute", left: "50%", top: "50%", marginLeft: -PIN / 2, marginTop: -PIN * 1.2 },
  pin: { width: PIN, height: PIN, borderRadius: PIN / 2, borderBottomRightRadius: 0, transform: [{ rotate: "45deg" }], backgroundColor: colors.primary, borderWidth: 2, borderColor: colors.surface },
  hint: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
});
