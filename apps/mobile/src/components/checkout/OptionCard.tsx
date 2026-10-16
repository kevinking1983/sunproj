import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, View } from "react-native";

import { Typography } from "@/components/ui";
import { colors, radius, spacing } from "@/constants/theme";

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  right?: React.ReactNode;
}

export function OptionCard({ icon, title, subtitle, selected, disabled, onPress, right }: Props) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.card, selected && styles.selected, disabled && styles.disabled]}>
      <View style={styles.icon}>
        <Ionicons name={icon} size={20} color={selected ? colors.primary : colors.textMuted} />
      </View>
      <View style={styles.body}>
        <Typography variant="label" weight="semibold">{title}</Typography>
        {subtitle ? <Typography variant="caption" tone="muted" numberOfLines={2}>{subtitle}</Typography> : null}
      </View>
      {right ?? (selected ? <Ionicons name="checkmark-circle" size={22} color={colors.primary} /> : <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  selected: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  disabled: { opacity: 0.5 },
  icon: { width: 36, height: 36, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, alignItems: "center", justifyContent: "center" },
  body: { flex: 1, gap: 2 },
});
