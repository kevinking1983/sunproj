import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Typography } from "@/components/ui";
import { colors, radius, spacing } from "@/constants/theme";
import { selectCount, selectSubtotal, useCart } from "@/stores/cart";
import { formatInr } from "@ration/shared";

/** Sticky "View cart" bar shown above the tab bar whenever the cart has items. */
export function CartBar({ bottom = 0 }: { bottom?: number }) {
  const count = useCart(selectCount);
  const subtotal = useCart(selectSubtotal);
  const insets = useSafeAreaInsets();
  if (count === 0) return null;
  return (
    <Pressable onPress={() => router.push("/cart")} style={[styles.bar, { bottom: bottom + Math.max(insets.bottom, spacing.sm) }]}>
      <View>
        <Typography variant="label" tone="onPrimary">{count} {count === 1 ? "item" : "items"}</Typography>
        <Typography variant="heading" tone="onPrimary">{formatInr(subtotal)}</Typography>
      </View>
      <View style={styles.cta}>
        <Typography variant="label" weight="bold" tone="onPrimary">View cart</Typography>
        <Ionicons name="chevron-forward" size={18} color={colors.textOnPrimary} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: colors.primaryDark,
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  cta: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
});
