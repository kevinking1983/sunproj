import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";

import { PinMapOrNothing, pinMapAvailable } from "@/components/location/PinMapOrNothing";
import { Button, Screen, Typography } from "@/components/ui";
import { colors, radius, spacing } from "@/constants/theme";
import { maps, type GeoPoint } from "@/lib/maps";
import { useLocation } from "@/stores/location";

/** Shown after a GPS or search result: confirms serviceability before the user decides to save it. */
export default function ConfirmLocationScreen() {
  const { location, store, status, setLocation } = useLocation();
  const pinTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (pinTimer.current) clearTimeout(pinTimer.current);
  }, []);

  // Pin dragged: look the point up again (debounced; geocoders are rate limited) and
  // re-check serviceability. If the lookup fails keep the old text with the new point.
  const pinMoved = (point: GeoPoint) => {
    if (pinTimer.current) clearTimeout(pinTimer.current);
    pinTimer.current = setTimeout(async () => {
      const current = useLocation.getState().location;
      if (!current) return;
      const r = await maps.reverseGeocode(point).catch(() => null);
      await setLocation(r ?? { ...current, ...point, addressId: undefined, addressLabel: undefined });
    }, 400);
  };

  if (!location) {
    router.replace("/location");
    return null;
  }

  const serviceable = status === "ready" && !!store;

  return (
    <Screen edges={["top", "bottom"]}>
      {pinMapAvailable ? (
        <View style={styles.map}>
          <PinMapOrNothing center={{ lat: location.lat, lng: location.lng }} onMove={pinMoved} />
        </View>
      ) : (
        <View style={styles.pin}>
          <Ionicons name="location" size={48} color={serviceable ? colors.primary : colors.danger} />
        </View>
      )}
      <Typography variant="title" center>{location.label}</Typography>
      <Typography tone="muted" center style={{ marginTop: spacing.xs }}>{location.line1}</Typography>

      <View style={[styles.status, { backgroundColor: serviceable ? colors.successTint : colors.dangerTint }]}>
        {status === "resolving" ? (
          <Typography tone="muted">Checking if we deliver here…</Typography>
        ) : serviceable ? (
          <>
            <Typography weight="semibold" tone="success">We deliver here</Typography>
            <Typography variant="caption" tone="muted">
              {store.name} · about {store.promised_minutes} minutes away
            </Typography>
          </>
        ) : (
          <>
            <Typography weight="semibold" tone="danger">Not serviceable yet</Typography>
            <Typography variant="caption" tone="muted">We are not delivering to this area right now. Try another location.</Typography>
          </>
        )}
      </View>

      <View style={styles.actions}>
        <Button
          title="Save as an address"
          variant="secondary"
          fullWidth
          disabled={!serviceable}
          onPress={() => router.push("/location/form")}
        />
        <Button
          title="Deliver here"
          variant="accent"
          size="lg"
          fullWidth
          disabled={!serviceable}
          onPress={() => router.dismissAll()}
        />
        <Button title="Change location" variant="ghost" fullWidth onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pin: { alignItems: "center", marginTop: spacing.xxxl, marginBottom: spacing.lg },
  map: { marginTop: spacing.lg, marginBottom: spacing.lg },
  status: { marginTop: spacing.xxl, padding: spacing.lg, borderRadius: radius.lg, gap: spacing.xs, alignItems: "center" },
  actions: { marginTop: "auto", gap: spacing.md },
});
