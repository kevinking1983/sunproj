import { Pressable, StyleSheet, View } from "react-native";

import { Typography } from "@/components/ui";
import { colors, spacing } from "@/constants/theme";

export function SectionHeader({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) {
  return (
    <View style={styles.row}>
      <Typography variant="heading">{title}</Typography>
      {onSeeAll ? (
        <Pressable onPress={onSeeAll} hitSlop={8}>
          <Typography variant="label" weight="semibold" style={{ color: colors.primary }}>See all</Typography>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.md },
});
