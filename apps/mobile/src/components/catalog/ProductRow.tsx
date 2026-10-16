import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { Typography } from "@/components/ui";
import { colors, spacing } from "@/constants/theme";
import type { Product } from "@/lib/api/catalog";
import { formatInr } from "@ration/shared";

import { AddButton } from "./AddButton";
import { ProductCard, discountPercent } from "./ProductCard";
import { ProductImage } from "./ProductImage";

/** Horizontal list row used in search results and category listings. */
export function ProductRow({ product }: { product: Product }) {
  const off = discountPercent(product);
  return (
    <Pressable onPress={() => router.push({ pathname: "/product/[slug]", params: { slug: product.slug } })} style={styles.row}>
      <ProductImage uri={product.images[0]} size={72} />
      <View style={styles.body}>
        <Typography variant="label" numberOfLines={2}>{product.name}</Typography>
        <Typography variant="caption" tone="muted">{product.unit_label}</Typography>
        <View style={styles.price}>
          <Typography variant="label" weight="bold">{formatInr(product.price)}</Typography>
          {off > 0 ? <Typography variant="caption" tone="muted" style={styles.mrp}>{formatInr(product.mrp)}</Typography> : null}
          {off > 0 ? <Typography variant="caption" weight="bold" tone="success">{off}% OFF</Typography> : null}
        </View>
      </View>
      <AddButton product={product} />
    </Pressable>
  );
}

export { ProductCard };

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, backgroundColor: colors.surface },
  body: { flex: 1, gap: 2 },
  price: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: 2 },
  mrp: { textDecorationLine: "line-through" },
});
