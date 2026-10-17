import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";

import { CartBar } from "@/components/cart/CartBar";
import { AddButton } from "@/components/catalog/AddButton";
import { ProductImage } from "@/components/catalog/ProductImage";
import { discountPercent } from "@/components/catalog/ProductCard";
import { Screen, Typography } from "@/components/ui";
import { colors, radius, spacing } from "@/constants/theme";
import { catalogApi } from "@/lib/api/catalog";
import { queryKeys } from "@/lib/query";
import { useLocation } from "@/stores/location";
import { formatInr } from "@ration/shared";

export default function ProductScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { width } = useWindowDimensions();
  const storeId = useLocation((s) => s.store?.id ?? "");
  const product = useQuery({ queryKey: queryKeys.product(`${storeId}:${slug}`), queryFn: () => catalogApi.product(storeId, slug), enabled: !!storeId && !!slug });
  const p = product.data;

  return (
    <Screen padded={false} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Pressable onPress={() => router.push("/search")} hitSlop={12}>
          <Ionicons name="search" size={22} color={colors.text} />
        </Pressable>
      </View>
      {product.isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxl }} />
      ) : !p ? (
        <Typography tone="muted" center style={{ marginTop: spacing.xxl }}>This product is not available at your store.</Typography>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
          <ProductImage uri={p.images[0]} size={width - spacing.lg * 2} style={styles.image} />
          {p.images[0] && p.image_credit ? <Typography variant="caption" tone="muted" center style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xs }}>{p.image_credit}</Typography> : null}
          <View style={styles.body}>
            {p.brand_name ? <Typography variant="label" tone="muted">{p.brand_name}</Typography> : null}
            <Typography variant="title">{p.name}</Typography>
            <Typography tone="muted">{p.unit_label}</Typography>
            <View style={styles.priceRow}>
              <View style={{ flex: 1, gap: 2 }}>
                <View style={styles.price}>
                  <Typography variant="title">{formatInr(p.price)}</Typography>
                  {discountPercent(p) > 0 ? <Typography tone="muted" style={styles.mrp}>MRP {formatInr(p.mrp)}</Typography> : null}
                </View>
                {discountPercent(p) > 0 ? <Typography variant="label" weight="bold" tone="success">{discountPercent(p)}% OFF · inclusive of all taxes</Typography> : <Typography variant="caption" tone="muted">Inclusive of all taxes</Typography>}
              </View>
              <AddButton product={p} />
            </View>
            {p.orderable === false ? <Typography variant="caption" tone="muted">We are getting this ready for delivery. It will be available to order soon.</Typography> : null}
            {p.is_veg !== null ? (
              <View style={styles.row}>
                <View style={[styles.vegMark, { borderColor: p.is_veg ? colors.success : colors.danger }]}>
                  <View style={[styles.vegDot, { backgroundColor: p.is_veg ? colors.success : colors.danger }]} />
                </View>
                <Typography variant="label" tone="muted">{p.is_veg ? "Vegetarian" : "Non-vegetarian"}</Typography>
              </View>
            ) : null}
            {p.description ? (
              <View style={styles.section}>
                <Typography variant="heading">About this product</Typography>
                <Typography tone="muted">{p.description}</Typography>
              </View>
            ) : null}
            <View style={styles.section}>
              <Typography variant="heading">Why RATION</Typography>
              <Typography tone="muted">Fresh stock from your nearest store, delivered in minutes. Easy returns on damaged or incorrect items.</Typography>
            </View>
          </View>
        </ScrollView>
      )}
      <CartBar />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  image: { alignSelf: "center", borderRadius: radius.xl },
  body: { padding: spacing.lg, gap: spacing.xs },
  priceRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.md },
  price: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm },
  mrp: { textDecorationLine: "line-through" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.md },
  vegMark: { width: 16, height: 16, borderWidth: 1.5, borderRadius: 2, alignItems: "center", justifyContent: "center" },
  vegDot: { width: 8, height: 8, borderRadius: 4 },
  section: { marginTop: spacing.xl, gap: spacing.sm },
});
