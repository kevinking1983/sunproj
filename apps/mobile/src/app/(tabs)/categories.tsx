import { buildCategoryTree, categoryIcon } from "@ration/api";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";

import { CartBar } from "@/components/cart/CartBar";
import { CategoryTile } from "@/components/catalog/CategoryTile";
import { Screen, Typography } from "@/components/ui";
import { colors, spacing } from "@/constants/theme";
import { catalogApi } from "@/lib/api/catalog";
import { queryKeys } from "@/lib/query";

export default function CategoriesScreen() {
  const { width } = useWindowDimensions();
  const categories = useQuery({ queryKey: queryKeys.categories, queryFn: catalogApi.categories });
  const tree = useMemo(() => buildCategoryTree(categories.data ?? []), [categories.data]);
  const tileWidth = Math.floor((width - spacing.lg * 2) / 4);

  return (
    <Screen padded={false}>
      <Typography variant="title" style={styles.title}>All categories</Typography>
      {categories.isLoading ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {tree.map((dept) => (
            <View key={dept.id}>
              <Typography variant="heading" style={styles.heading}>{dept.name}</Typography>
              <View style={styles.grid}>
                {dept.children.map((c) => (
                  <CategoryTile key={c.id} category={c} width={tileWidth} icon={categoryIcon(tree, c.slug)} />
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
      <CartBar />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  scroll: { paddingBottom: 120 },
  heading: { paddingHorizontal: spacing.lg, marginTop: spacing.lg, marginBottom: spacing.xs },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: spacing.lg },
});
