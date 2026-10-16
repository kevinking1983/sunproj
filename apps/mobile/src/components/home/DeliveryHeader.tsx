import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { Typography } from "@/components/ui";
import { colors, spacing } from "@/constants/theme";
import { useLocation } from "@/stores/location";

export function DeliveryHeader() {
  const { location, store, status } = useLocation();
  const eta = store ? `${store.promised_minutes} minutes` : "—";

  return (
    <View style={styles.wrap}>
      <Pressable onPress={() => router.push("/location")} style={styles.address}>
        <Typography variant="caption" tone="onDark" style={styles.eyebrow}>
          {status === "ready" ? "Delivery in" : status === "unserviceable" ? "Not serviceable" : "Set your location"}
        </Typography>
        <View style={styles.row}>
          {status === "ready" ? (
            <Typography variant="title" tone="onDark">{eta}</Typography>
          ) : null}
        </View>
        <View style={styles.row}>
          <Ionicons name="location" size={14} color={colors.accent} />
          <Typography variant="label" tone="onDark" numberOfLines={1} style={{ flex: 1 }}>
            {location ? `${location.label}` : "Tap to choose a delivery address"}
          </Typography>
          <Ionicons name="chevron-down" size={16} color={colors.textOnDark} />
        </View>
      </Pressable>
      <Pressable onPress={() => router.push("/(tabs)/account")} hitSlop={8} style={styles.avatar}>
        <Ionicons name="person-circle-outline" size={32} color={colors.textOnDark} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md, gap: spacing.md },
  address: { flex: 1, gap: 2 },
  eyebrow: { opacity: 0.8, letterSpacing: 0.4, textTransform: "uppercase" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  avatar: { paddingLeft: spacing.sm },
});
