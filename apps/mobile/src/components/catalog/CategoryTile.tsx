import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { Typography } from "@/components/ui";
import { colors, radius, spacing } from "@/constants/theme";
import type { Category } from "@/lib/api/catalog";

export function CategoryTile({ category, width }: { category: Category; width: number }) {
  return (
    <Pressable onPress={() => router.push({ pathname: "/category/[slug]", params: { slug: category.slug } })} style={[styles.tile, { width }]}>
      <View style={[styles.image, { width: width - spacing.sm * 2, height: width - spacing.sm * 2 }]}>
        {category.image_url ? <Image source={{ uri: category.image_url }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
      </View>
      <Typography variant="caption" weight="medium" center numberOfLines={2} style={styles.name}>{category.name}</Typography>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: "center", padding: spacing.sm },
  image: { borderRadius: radius.lg, backgroundColor: colors.primaryTint, overflow: "hidden" },
  name: { marginTop: spacing.xs, minHeight: 32 },
});
