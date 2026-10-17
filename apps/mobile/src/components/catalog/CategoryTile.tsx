import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { Typography } from "@/components/ui";
import { colors, radius, spacing } from "@/constants/theme";
import type { Category } from "@/lib/api/catalog";

interface Props {
  category: Pick<Category, "slug" | "name" | "image_url">;
  width: number;
  /** Shown when the category has no photo yet. */
  icon?: string;
  /** Open the parent category with this section selected. */
  sub?: string;
  label?: string;
}

export function CategoryTile({ category, width, icon, sub, label }: Props) {
  const size = width - spacing.sm * 2;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? category.name}
      onPress={() => router.push({ pathname: "/category/[slug]", params: sub ? { slug: category.slug, sub } : { slug: category.slug } })}
      style={[styles.tile, { width }]}
    >
      <View style={[styles.image, { width: size, height: size }]}>
        {category.image_url ? <Image source={{ uri: category.image_url }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Typography style={{ fontSize: size * 0.4 }}>{icon ?? "🛍️"}</Typography>}
      </View>
      <Typography variant="caption" weight="medium" center numberOfLines={2} style={styles.name}>{label ?? category.name}</Typography>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: "center", padding: spacing.sm },
  image: { borderRadius: radius.lg, backgroundColor: colors.primaryTint, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  name: { marginTop: spacing.xs, minHeight: 32 },
});
