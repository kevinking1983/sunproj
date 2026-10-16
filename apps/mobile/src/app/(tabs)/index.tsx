import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useMemo } from "react";
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CartBar } from "@/components/cart/CartBar";
import { BannerCarousel } from "@/components/catalog/BannerCarousel";
import { CategoryTile } from "@/components/catalog/CategoryTile";
import { ProductCard } from "@/components/catalog/ProductCard";
import { SearchBar } from "@/components/catalog/SearchBar";
import { SectionHeader } from "@/components/catalog/SectionHeader";
import { DeliveryHeader } from "@/components/home/DeliveryHeader";
import { Button, Typography } from "@/components/ui";
import { colors, radius, spacing } from "@/constants/theme";
import { catalogApi } from "@/lib/api/catalog";
import { queryKeys } from "@/lib/query";
import { useLocation } from "@/stores/location";

const RAIL_SIZE = 8;

export default function HomeScreen() {
  const { status, store, refreshStore } = useLocation();
  const { width } = useWindowDimensions();
  const storeId = store?.id ?? "";

  useEffect(() => {
    if (status === "idle") router.push("/location");
    else void refreshStore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const categories = useQuery({ queryKey: queryKeys.categories, queryFn: catalogApi.categories });
  const banners = useQuery({ queryKey: queryKeys.banners, queryFn: catalogApi.banners });
  const products = useQuery({ queryKey: queryKeys.products(storeId), queryFn: () => catalogApi.products(storeId), enabled: !!storeId });

  const topCategories = useMemo(() => (categories.data ?? []).filter((c) => !c.parent_id), [categories.data]);

  const productList = products.data;
  const rails = useMemo(() => {
    const byCategory = new Map<string, typeof productList>();
    for (const p of productList ?? []) {
      const list = byCategory.get(p.category_id) ?? [];
      if (list.length < RAIL_SIZE) list.push(p);
      byCategory.set(p.category_id, list);
    }
    return topCategories.map((c) => ({ category: c, items: byCategory.get(c.id) ?? [] })).filter((r) => r.items.length > 0);
  }, [productList, topCategories]);

  const refreshing = categories.isFetching || products.isFetching;
  const refresh = () => {
    void refreshStore();
    void categories.refetch();
    void banners.refetch();
    void products.refetch();
  };

  const tileWidth = Math.floor((width - spacing.lg * 2) / 4);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <DeliveryHeader />
      <SearchBar />
      <View style={styles.body}>
        {status === "unserviceable" ? (
          <View style={styles.notice}>
            <Typography variant="heading">We are not here yet</Typography>
            <Typography tone="muted" center>RATION does not deliver to this location right now. Pick another address to keep shopping.</Typography>
            <Button title="Change location" onPress={() => router.push("/location")} />
          </View>
        ) : !storeId || (products.isLoading && categories.isLoading) ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxxl }} />
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}>
            <BannerCarousel banners={banners.data ?? []} />

            <SectionHeader title="Shop by category" onSeeAll={() => router.push("/(tabs)/categories")} />
            <View style={styles.grid}>
              {topCategories.slice(0, 8).map((c) => (
                <CategoryTile key={c.id} category={c} width={tileWidth} />
              ))}
            </View>

            {rails.map((rail) => (
              <View key={rail.category.id}>
                <SectionHeader title={rail.category.name} onSeeAll={() => router.push({ pathname: "/category/[slug]", params: { slug: rail.category.slug } })} />
                <FlatList
                  horizontal
                  data={rail.items}
                  keyExtractor={(p) => p.id}
                  renderItem={({ item }) => <ProductCard product={item} />}
                  contentContainerStyle={styles.rail}
                  showsHorizontalScrollIndicator={false}
                />
              </View>
            ))}

            {rails.length === 0 && !products.isLoading ? (
              <Typography tone="muted" center style={{ marginTop: spacing.xxxl }}>No products stocked at {store?.name} yet.</Typography>
            ) : null}
          </ScrollView>
        )}
      </View>
      <CartBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.primaryDark },
  body: { flex: 1, backgroundColor: colors.background, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, overflow: "hidden" },
  scroll: { paddingBottom: 120 },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: spacing.lg },
  rail: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  notice: { marginTop: spacing.xxxl, alignItems: "center", gap: spacing.md, padding: spacing.lg },
});
