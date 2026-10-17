import Ionicons from "@expo/vector-icons/Ionicons";
import { buildCategoryTree, categoryIcon, categoryPath, descendantIds } from "@ration/api";
import { FlashList } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";

import { CartBar } from "@/components/cart/CartBar";
import { CategoryTile } from "@/components/catalog/CategoryTile";
import { ProductRow } from "@/components/catalog/ProductRow";
import { Screen, Typography } from "@/components/ui";
import { colors, radius, spacing } from "@/constants/theme";
import { catalogApi } from "@/lib/api/catalog";
import { queryKeys } from "@/lib/query";
import { useLocation } from "@/stores/location";

const RAIL_WIDTH = 84;

/**
 * Department: its categories as tiles. Category: a section rail on the left ("All" first) and
 * products on the right. A subcategory slug (or ?sub=) opens its category on that section.
 */
export default function CategoryScreen() {
  const { slug, sub } = useLocalSearchParams<{ slug: string; sub?: string }>();
  const { width } = useWindowDimensions();
  const storeId = useLocation((s) => s.store?.id ?? "");
  const categories = useQuery({ queryKey: queryKeys.categories, queryFn: catalogApi.categories });
  const tree = useMemo(() => buildCategoryTree(categories.data ?? []), [categories.data]);
  const path = useMemo(() => categoryPath(tree, slug), [tree, slug]);
  const node = path[path.length - 1];
  const category = node && node.depth >= 2 ? path[1] : node;
  const initialSub = node && node.depth >= 2 ? node.slug : (sub ?? null);
  const [picked, setPicked] = useState<string | null | undefined>(undefined);
  const activeSlug = picked === undefined ? initialSub : picked;
  const selected = category?.children.find((c) => c.slug === activeSlug) ?? null;
  const ids = useMemo(() => (category && category.depth > 0 ? (selected ? [selected.id] : descendantIds(category)) : []), [category, selected]);

  const products = useQuery({
    queryKey: queryKeys.products(storeId, `shelves:${ids.join(",")}`),
    queryFn: () => catalogApi.products(storeId, ids, selected ? 200 : 120),
    enabled: !!storeId && ids.length > 0,
  });

  const header = (
    <View style={styles.header}>
      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))} hitSlop={12} accessibilityLabel="Back">
        <Ionicons name="arrow-back" size={24} color={colors.text} />
      </Pressable>
      <Typography variant="heading" numberOfLines={1} style={{ flex: 1 }}>{category?.name ?? "Category"}</Typography>
      <Pressable onPress={() => router.push("/search")} hitSlop={12} accessibilityLabel="Search">
        <Ionicons name="search" size={22} color={colors.text} />
      </Pressable>
    </View>
  );

  if (categories.isLoading) return <Screen padded={false} edges={["top"]}>{header}<ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxl }} /></Screen>;
  if (!category) return <Screen padded={false} edges={["top"]}>{header}<Typography tone="muted" center style={{ marginTop: spacing.xxl }}>This category is not available.</Typography></Screen>;

  if (category.depth === 0) {
    const tileWidth = Math.floor((width - spacing.lg * 2) / 3);
    return (
      <Screen padded={false} edges={["top"]}>
        {header}
        <ScrollView contentContainerStyle={styles.deptGrid}>
          {category.children.map((c) => <CategoryTile key={c.id} category={c} width={tileWidth} icon={categoryIcon(tree, c.slug)} />)}
        </ScrollView>
        <CartBar />
      </Screen>
    );
  }

  const icon = categoryIcon(tree, category.slug);
  const sections = [{ id: "all", slug: null as string | null, name: "All", image_url: category.image_url }, ...category.children.map((c) => ({ id: c.id, slug: c.slug as string | null, name: c.name, image_url: c.image_url }))];
  return (
    <Screen padded={false} edges={["top"]}>
      {header}
      <View style={styles.split}>
        <ScrollView style={styles.rail} contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
          {sections.map((s) => {
            const on = s.slug === (selected?.slug ?? null);
            return (
              <Pressable key={s.id} onPress={() => setPicked(s.slug)} accessibilityRole="button" accessibilityState={{ selected: on }} style={[styles.section, on && styles.sectionOn]}>
                <View style={styles.sectionImage}>
                  {s.image_url ? <Image source={{ uri: s.image_url }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Typography style={{ fontSize: 22 }}>{icon}</Typography>}
                </View>
                <Typography variant="caption" weight={on ? "semibold" : "regular"} center numberOfLines={2} style={{ color: on ? colors.primary : colors.text }}>{s.name}</Typography>
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={{ flex: 1 }}>
          {products.isLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxl }} />
          ) : (
            <FlashList
              data={products.data ?? []}
              keyExtractor={(p) => p.id}
              renderItem={({ item }) => <ProductRow product={item} />}
              ItemSeparatorComponent={() => <View style={styles.sep} />}
              contentContainerStyle={{ paddingBottom: 120 }}
              ListHeaderComponent={<Typography variant="label" weight="bold" style={styles.listTitle}>{selected ? selected.name : `All ${category.name}`}</Typography>}
              ListEmptyComponent={<Typography tone="muted" center style={{ marginTop: spacing.xxl }}>Nothing stocked here yet.</Typography>}
            />
          )}
        </View>
      </View>
      <CartBar />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  deptGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: spacing.lg, paddingBottom: 120 },
  split: { flex: 1, flexDirection: "row", borderTopWidth: 1, borderTopColor: colors.divider },
  rail: { width: RAIL_WIDTH, flexGrow: 0, backgroundColor: colors.surfaceMuted },
  section: { alignItems: "center", gap: 4, paddingVertical: spacing.sm, paddingHorizontal: 4, borderLeftWidth: 3, borderLeftColor: "transparent" },
  sectionOn: { backgroundColor: colors.surface, borderLeftColor: colors.primary },
  sectionImage: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.primaryTint, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  listTitle: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xs },
  sep: { height: 1, backgroundColor: colors.divider },
});
