import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { FlatList, StyleSheet, View } from "react-native";

import { ProductCard } from "@/components/catalog/ProductCard";
import { SectionHeader } from "@/components/catalog/SectionHeader";
import { spacing } from "@/constants/theme";
import { catalogApi, type Category } from "@/lib/api/catalog";
import { queryKeys } from "@/lib/query";

/** Horizontal product rail for one shelf; renders nothing while the shelf is empty. */
export function ShelfRail({ storeId, shelf, parent, size = 10 }: { storeId: string; shelf: Category; parent?: Category; size?: number }) {
  const products = useQuery({ queryKey: queryKeys.products(storeId, `shelf:${shelf.id}`), queryFn: () => catalogApi.products(storeId, [shelf.id], size), enabled: !!storeId });
  if (!products.data?.length) return null;
  return (
    <View>
      <SectionHeader
        title={shelf.name}
        onSeeAll={() => router.push({ pathname: "/category/[slug]", params: parent ? { slug: parent.slug, sub: shelf.slug } : { slug: shelf.slug } })}
      />
      <FlatList horizontal data={products.data} keyExtractor={(p) => p.id} renderItem={({ item }) => <ProductCard product={item} />} contentContainerStyle={styles.rail} showsHorizontalScrollIndicator={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  rail: { paddingHorizontal: spacing.lg, gap: spacing.sm },
});
