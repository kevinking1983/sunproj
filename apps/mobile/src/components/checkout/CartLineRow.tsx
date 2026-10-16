import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, View } from "react-native";

import { ProductImage } from "@/components/catalog/ProductImage";
import { Typography } from "@/components/ui";
import { colors, radius, spacing } from "@/constants/theme";
import { useCart, type CartLine } from "@/stores/cart";
import { formatInr } from "@ration/shared";

export function CartLineRow({ line }: { line: CartLine }) {
  const increment = useCart((s) => s.increment);
  const decrement = useCart((s) => s.decrement);
  const atMax = line.quantity >= line.available;
  return (
    <View style={styles.row}>
      <ProductImage uri={line.image} size={56} />
      <View style={styles.body}>
        <Typography variant="label" numberOfLines={2}>{line.name}</Typography>
        <Typography variant="caption" tone="muted">{line.unit_label}</Typography>
        <View style={styles.price}>
          <Typography variant="label" weight="bold">{formatInr(line.price * line.quantity)}</Typography>
          {line.mrp > line.price ? <Typography variant="caption" tone="muted" style={styles.mrp}>{formatInr(line.mrp * line.quantity)}</Typography> : null}
        </View>
      </View>
      <View style={styles.stepper}>
        <Pressable onPress={() => decrement(line.productId)} hitSlop={8} style={styles.step} accessibilityLabel="Remove one">
          <Ionicons name={line.quantity === 1 ? "trash-outline" : "remove"} size={16} color={colors.textOnPrimary} />
        </Pressable>
        <Typography variant="label" weight="bold" tone="onPrimary">{line.quantity}</Typography>
        <Pressable onPress={() => increment(line.productId)} hitSlop={8} style={styles.step} disabled={atMax} accessibilityLabel="Add one">
          <Ionicons name="add" size={16} color={atMax ? colors.primaryLight : colors.textOnPrimary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  body: { flex: 1, gap: 2 },
  price: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  mrp: { textDecorationLine: "line-through" },
  stepper: { height: 32, minWidth: 84, backgroundColor: colors.primary, borderRadius: radius.sm, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 2 },
  step: { width: 28, height: "100%", alignItems: "center", justifyContent: "center" },
});
