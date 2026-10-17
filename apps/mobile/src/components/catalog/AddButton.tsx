import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet, View } from "react-native";

import { Typography } from "@/components/ui";
import { colors, radius } from "@/constants/theme";
import type { Product } from "@/lib/api/catalog";
import { selectQuantity, useCart } from "@/stores/cart";
import { useLocation } from "@/stores/location";

interface Props {
  product: Product;
  compact?: boolean;
}

/** "ADD" that turns into a − qty + stepper once the product is in the cart. */
export function AddButton({ product, compact }: Props) {
  const quantity = useCart(selectQuantity(product.id));
  const add = useCart((s) => s.add);
  const increment = useCart((s) => s.increment);
  const decrement = useCart((s) => s.decrement);
  const storeId = useLocation((s) => s.store?.id);

  const tap = (fn: () => void) => () => {
    void Haptics.selectionAsync();
    fn();
  };

  const height = compact ? 30 : 34;

  if (product.orderable === false) {
    return (
      <View style={[styles.base, styles.soon, { height }]}>
        <Typography variant="caption" weight="semibold" style={{ color: colors.goldText }}>Coming soon</Typography>
      </View>
    );
  }

  if (product.available <= 0) {
    return (
      <View style={[styles.base, styles.disabled, { height }]}>
        <Typography variant="caption" tone="muted">Out of stock</Typography>
      </View>
    );
  }

  if (quantity === 0) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Add ${product.name} to cart`}
        onPress={tap(() => storeId && add(product, storeId))}
        style={({ pressed }) => [styles.base, styles.add, { height, opacity: pressed ? 0.85 : 1 }]}
      >
        <Typography variant="label" weight="bold" style={{ color: colors.primary }}>ADD</Typography>
      </Pressable>
    );
  }

  const atMax = quantity >= product.available;
  return (
    <View style={[styles.base, styles.stepper, { height }]}>
      <Pressable onPress={tap(() => decrement(product.id))} hitSlop={8} style={styles.step} accessibilityLabel="Remove one">
        <Ionicons name="remove" size={16} color={colors.textOnPrimary} />
      </Pressable>
      <Typography variant="label" weight="bold" tone="onPrimary">{quantity}</Typography>
      <Pressable onPress={tap(() => increment(product.id))} hitSlop={8} style={styles.step} disabled={atMax} accessibilityLabel="Add one">
        <Ionicons name="add" size={16} color={atMax ? colors.primaryLight : colors.textOnPrimary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { minWidth: 74, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  add: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.primary },
  stepper: { backgroundColor: colors.primary, flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 2 },
  step: { width: 28, height: "100%", alignItems: "center", justifyContent: "center" },
  disabled: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
  soon: { backgroundColor: colors.accentTint, borderWidth: 1, borderColor: colors.accent },
});
