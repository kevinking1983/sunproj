import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { Pressable, StyleSheet } from "react-native";

import { Typography } from "@/components/ui";
import { colors, radius, spacing } from "@/constants/theme";

/** Tappable search field on Home that opens the search screen. */
export function SearchBar() {
  return (
    <Pressable onPress={() => router.push("/search")} style={styles.bar} accessibilityRole="search">
      <Ionicons name="search" size={18} color={colors.textMuted} />
      <Typography tone="muted">Search for atta, milk, chips…</Typography>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    height: 46,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
  },
});
