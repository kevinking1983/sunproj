import { distanceMetres, estimateMinutes } from "@ration/api";
import type { ComponentType } from "react";
import { StyleSheet, View } from "react-native";

import { Typography } from "@/components/ui";
import { colors, radius, spacing } from "@/constants/theme";
import { useRider } from "@/stores/rider";

interface Props {
  destination: { lat: number; lng: number };
}

const loadMap = (): ComponentType<Props> | null => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("@maplibre/maplibre-react-native");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require("./DeliveryMap") as { DeliveryMap: ComponentType<Props> }).DeliveryMap;
  } catch {
    return null;
  }
};

const NativeMap = loadMap();

function Fallback({ destination }: Props) {
  const me = useRider((s) => s.position);
  const metres = me ? distanceMetres(me, destination) : null;
  return (
    <View style={styles.card}>
      <Typography variant="heading">{metres !== null ? `${(metres / 1000).toFixed(1)} km · about ${estimateMinutes(metres)} min` : "Waiting for your location…"}</Typography>
      <Typography variant="caption" tone="muted">Use Navigate to open directions. The in-app map needs a development build.</Typography>
    </View>
  );
}

export function MapOrFallback(props: Props) {
  return NativeMap ? <NativeMap {...props} /> : <Fallback {...props} />;
}

const styles = StyleSheet.create({ card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.xs } });
