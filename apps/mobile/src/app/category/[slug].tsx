import Ionicons from "@expo/vector-icons/Ionicons";
import { FlashList } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { CartBar } from "@/components/cart/CartBar";
import { ProductRow } from "@/components/catalog/ProductRow";
import { Screen, Typography } from "@/components/ui";
import { colors, radius, spacing } from "@/constants/theme";
import { catalogApi } from "@/lib/api/catalog";
import { queryKeys } from "@/lib/query";
import { useLocation } from "@/stores/location";

export default function CategoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const storeId = useLocation((s) => s.store?.id ?? "");
  const [activeChild, setActiveChild] = useState<string | null>(null);

  const categories = useQuery({ queryKey: queryKeys.categories, queryFn: catalogApi.categories });
  const category = categories.data?.find((c) => c.slug === slug);
  const children = useMemo(() => (categories.data ?? []).filter((c) => c.parent_id === category?.id), [categories.data, category?.id]);
  const ids = useMemo(() => {
    if (!category) return [];
    if (activeChild) return [activeChild];
    return [category.id, ...children.map((c) => c.id)];
  }, [category, children, activeChild]);

  const products = useQuery({
    queryKey: queryKeys.products(storeId, ids.join(",")),
    queryFn: () => catalogApi.products(storeId, ids),
    enabled: !!storeId && ids.length > 0,
  });

  return (
    <Screen padded={false} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Typography variant="heading" numberOfLines={1} style={{ flex: 1 }}>{category?.name ?? "Category"}</Typography>
        <Pressable onPress={() => router.push("/search")} hitSlop={12}>
          <Ionicons name="search" size={22} color={colors.text} />
        </Pressable>
      </View>

      {children.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {[{ id: null, name: "All" }, ...children].map((c) => {
            const active = activeChild === c.id;
            return (
              <Pressable key={c.id ?? "all"} onPress={() => setActiveChild(c.id)} style={[styles.chip, active && styles.chipActive]}>
                <Typography variant="label" style={{ color: active ? colors.textOnPrimary : colors.text }}>{c.name}</Typography>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {products.isLoading || categories.isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxl }} />
      ) : (
        <FlashList
          data={products.data ?? []}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => <ProductRow product={item} />}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          contentContainerStyle={{ paddingBottom: 120 }}
          ListEmptyComponent={<Typography tone="muted" center style={{ marginTop: spacing.xxl }}>Nothing stocked here yet.</Typography>}
        />
      )}
      <CartBar />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  chips: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.md },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  sep: { height: 1, backgroundColor: colors.divider },
});
