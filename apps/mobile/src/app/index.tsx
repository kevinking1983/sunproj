import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, fontSize, fontWeight, radius, spacing } from "@/constants/theme";
import { formatInr } from "@ration/shared";

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Delivery in 15 minutes</Text>
        <Text style={styles.title}>RATION</Text>
        <Text style={styles.subtitle}>Groceries, delivered fresh.</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Scaffold check</Text>
          <Text style={styles.cardText}>
            Brand theme loaded from @ration/shared. Sample price: {formatInr(25900)}
          </Text>
          <View style={styles.cta}>
            <Text style={styles.ctaText}>Add to cart</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.primaryDark },
  header: {
    backgroundColor: colors.primaryDark,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  eyebrow: { color: colors.accent, fontSize: fontSize.sm, fontWeight: fontWeight.semibold, letterSpacing: 0.5 },
  title: { color: colors.textOnDark, fontSize: fontSize.display, fontWeight: fontWeight.bold, marginTop: spacing.xs },
  subtitle: { color: colors.textOnDark, fontSize: fontSize.md, opacity: 0.85, marginTop: spacing.xxs },
  body: {
    flex: 1,
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.semibold },
  cardText: { color: colors.textMuted, fontSize: fontSize.md },
  cta: {
    marginTop: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  ctaText: { color: colors.textOnAccent, fontSize: fontSize.md, fontWeight: fontWeight.bold },
});
