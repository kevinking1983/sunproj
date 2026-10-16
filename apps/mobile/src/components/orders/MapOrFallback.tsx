import { createTrackingApi, distanceMetres, estimateMinutes, type RiderPosition } from "@ration/api";
import { useEffect, useState, type ComponentType } from "react";
import { StyleSheet, View } from "react-native";

import { Typography } from "@/components/ui";
import { colors, radius, spacing } from "@/constants/theme";
import { supabase } from "@/lib/supabase";

interface Props {
  riderId: string | null;
  destination: { lat: number; lng: number };
  store?: { lat: number; lng: number; name: string } | null;
}

/**
 * The MapLibre map is a native module, absent in Expo Go. Load it lazily and fall back to a
 * distance/ETA card so the order screen works everywhere.
 */
const loadMap = (): ComponentType<Props> | null => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("@maplibre/maplibre-react-native");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require("./LiveMap") as { LiveMap: ComponentType<Props> }).LiveMap;
  } catch {
    return null;
  }
};

const NativeMap = loadMap();

function Fallback({ riderId, destination }: Props) {
  const [rider, setRider] = useState<RiderPosition | null>(null);
  useEffect(() => {
    if (!riderId) return;
    const t = createTrackingApi(supabase);
    t.getRiderPosition(riderId).then((p) => p && setRider(p)).catch(() => undefined);
    return t.subscribeRider(riderId, setRider);
  }, [riderId]);
  const metres = rider ? distanceMetres(rider, destination) : null;
  return (
    <View style={styles.card}>
      <Typography variant="heading">Live tracking</Typography>
      <Typography tone="muted">
        {metres !== null ? `Your delivery partner is ${(metres / 1000).toFixed(1)} km away, about ${estimateMinutes(metres)} min.` : riderId ? "Waiting for the delivery partner location…" : "Starts once a delivery partner picks up your order."}
      </Typography>
      <Typography variant="caption" tone="muted">The map needs a development build of the app; Expo Go shows distance only.</Typography>
    </View>
  );
}

export function MapOrFallback(props: Props) {
  return NativeMap ? <NativeMap {...props} /> : <Fallback {...props} />;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.xs },
});
