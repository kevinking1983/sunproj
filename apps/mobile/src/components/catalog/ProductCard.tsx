import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { Typography } from "@/components/ui";
import { colors, radius, spacing } from "@/constants/theme";
import type { Product } from "@/lib/api/catalog";
import { formatInr } from "@ration/shared";

import { AddButton } from "./AddButton";
import { ProductImage } from "./ProductImage";

interface Props {
  product: Product;
  width?: number;
}

export const discountPercent = (p: Pick<Product, "mrp" | "price">) => (p.mrp > p.price ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : 0);

export function ProductCard({ product, width = 150 }: Props) {
  const off = discountPercent(product);
  return (
    <Pressable onPress={() => router.push({ pathname: "/product/[slug]", params: { slug: product.slug } })} style={[styles.card, { width }]}>
      <View>
        <ProductImage uri={product.images[0]} size={width - spacing.md * 2} style={styles.image} />
        {off > 0 ? (
          <View style={styles.badge}>
            <Typography variant="caption" weight="bold" style={{ color: colors.textOnAccent }}>{off}% OFF</Typography>
          </View>
        ) : null}
      </View>
      <Typography variant="label" numberOfLines={2} style={styles.name}>{product.name}</Typography>
      <Typography variant="caption" tone="muted">{product.unit_label}</Typography>
      <View style={styles.footer}>
        <View>
          <Typography variant="label" weight="bold">{formatInr(product.price)}</Typography>
          {off > 0 ? <Typography variant="caption" tone="muted" style={styles.mrp}>{formatInr(product.mrp)}</Typography> : null}
        </View>
        <AddButton product={product} compact />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 2,
  },
  image: { alignSelf: "center", marginBottom: spacing.sm },
  badge: {
    position: "absolute",
    top: 0,
    left: 0,
    backgroundColor: colors.accent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.xs,
  },
  name: { minHeight: 36 },
  footer: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: spacing.xs },
  mrp: { textDecorationLine: "line-through" },
});
