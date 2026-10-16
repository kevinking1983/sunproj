import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { StyleSheet, View } from "react-native";

import { Button, Screen, Typography } from "@/components/ui";
import { colors, radius, spacing } from "@/constants/theme";
import { useLocation } from "@/stores/location";

/** Shown after a GPS or search result: confirms serviceability before the user decides to save it. */
export default function ConfirmLocationScreen() {
  const { location, store, status } = useLocation();

  if (!location) {
    router.replace("/location");
    return null;
  }

  const serviceable = status === "ready" && !!store;

  return (
    <Screen edges={["top", "bottom"]}>
      <View style={styles.pin}>
        <Ionicons name="location" size={48} color={serviceable ? colors.primary : colors.danger} />
      </View>
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
  status: { marginTop: spacing.xxl, padding: spacing.lg, borderRadius: radius.lg, gap: spacing.xs, alignItems: "center" },
  actions: { marginTop: "auto", gap: spacing.md },
});
