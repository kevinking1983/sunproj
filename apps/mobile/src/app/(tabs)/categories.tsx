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

  const groups = useMemo(() => {
    const all = categories.data ?? [];
    return all.filter((c) => !c.parent_id).map((parent) => ({ parent, children: all.filter((c) => c.parent_id === parent.id) }));
  }, [categories.data]);

  const tileWidth = Math.floor((width - spacing.lg * 2) / 3);

  return (
    <Screen padded={false}>
      <Typography variant="title" style={styles.title}>All categories</Typography>
      {categories.isLoading ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {groups.map(({ parent, children }) => (
            <View key={parent.id}>
              <Typography variant="heading" style={styles.heading}>{parent.name}</Typography>
              <View style={styles.grid}>
                <CategoryTile category={parent} width={tileWidth} />
                {children.map((c) => (
                  <CategoryTile key={c.id} category={c} width={tileWidth} />
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
