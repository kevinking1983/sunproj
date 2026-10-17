import { buildCategoryTree, categoryIcon, findCategory, type CategoryNode } from "@ration/api";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useMemo } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CartBar } from "@/components/cart/CartBar";
import { BannerCarousel } from "@/components/catalog/BannerCarousel";
import { CategoryTile } from "@/components/catalog/CategoryTile";
import { SearchBar } from "@/components/catalog/SearchBar";
import { SectionHeader } from "@/components/catalog/SectionHeader";
import { ShelfRail } from "@/components/catalog/ShelfRail";
import { DeliveryHeader } from "@/components/home/DeliveryHeader";
import { Button, Typography } from "@/components/ui";
import { colors, radius, spacing } from "@/constants/theme";
import { catalogApi } from "@/lib/api/catalog";
import { queryKeys } from "@/lib/query";
import { useLocation } from "@/stores/location";

/** Everyday shelves featured on the home screen, in this order (same list as the website). */
const FEATURED_SHELVES = [
  "dairy-bread-eggs-milk",
  "atta-rice-dal-dal",
  "dairy-bread-eggs-bread-pav",
  "vegetables-fruits-fresh-vegetables",
  "vegetables-fruits-fresh-fruits",
  "chips-namkeen-chips-wafers",
  "drinks-juices-soft-drinks",
  "sweets-chocolates-chocolates",
  "bath-body-bathing-soaps",
  "cleaners-repellents-liquid-detergents",
];

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
  const tree = useMemo(() => buildCategoryTree(categories.data ?? []), [categories.data]);
  const featured = useMemo(
    () =>
      FEATURED_SHELVES.map((slug) => findCategory(tree, slug))
        .filter((n): n is CategoryNode => !!n)
        .map((shelf) => ({ shelf, parent: (categories.data ?? []).find((c) => c.id === shelf.parent_id) })),
    [tree, categories.data],
  );

  const refreshing = categories.isFetching;
  const refresh = () => {
    void refreshStore();
    void categories.refetch();
    void banners.refetch();
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
        ) : !storeId || categories.isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxxl }} />
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}>
            <BannerCarousel banners={banners.data ?? []} />

            <SectionHeader title="Shop by category" onSeeAll={() => router.push("/(tabs)/categories")} />
            {tree.map((dept) => (
              <View key={dept.id}>
                <Typography variant="label" weight="bold" style={styles.dept}>{dept.name}</Typography>
                <View style={styles.grid}>
                  {dept.children.map((c) => (
                    <CategoryTile key={c.id} category={c} width={tileWidth} icon={categoryIcon(tree, c.slug)} />
                  ))}
                </View>
              </View>
            ))}

            {featured.map(({ shelf, parent }) => (
              <ShelfRail key={shelf.id} storeId={storeId} shelf={shelf} parent={parent} />
            ))}
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
  dept: { paddingHorizontal: spacing.lg, marginTop: spacing.md },
  notice: { marginTop: spacing.xxxl, alignItems: "center", gap: spacing.md, padding: spacing.lg },
});
