import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, useWindowDimensions } from "react-native";

import { colors, radius, spacing } from "@/constants/theme";
import type { Banner } from "@/lib/api/catalog";

export function BannerCarousel({ banners }: { banners: Banner[] }) {
  const { width } = useWindowDimensions();
  if (!banners.length) return null;
  const w = width - spacing.lg * 2;
  const open = (b: Banner) => {
    if (b.target_type === "category" && b.target_id) router.push({ pathname: "/category/[slug]", params: { slug: b.target_id } });
    else if (b.target_type === "product" && b.target_id) router.push({ pathname: "/product/[slug]", params: { slug: b.target_id } });
  };
  return (
    <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={styles.track} snapToInterval={w + spacing.sm} decelerationRate="fast">
      {banners.map((b) => (
        <Pressable key={b.id} onPress={() => open(b)} style={[styles.card, { width: w }]} accessibilityLabel={b.title ?? "Offer banner"}>
          <Image source={{ uri: b.image_url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  track: { paddingHorizontal: spacing.lg, gap: spacing.sm, marginTop: spacing.md },
  card: { aspectRatio: 2.4, borderRadius: radius.lg, backgroundColor: colors.primaryTint, overflow: "hidden" },
});
