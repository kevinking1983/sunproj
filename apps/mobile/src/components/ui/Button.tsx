import * as Haptics from "expo-haptics";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type PressableProps, type ViewStyle } from "react-native";

import { colors, fontSize, fontWeight, radius, spacing } from "@/constants/theme";

type Variant = "primary" | "accent" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface Props extends Omit<PressableProps, "style"> {
  title: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  left?: React.ReactNode;
  right?: React.ReactNode;
  style?: ViewStyle;
  haptic?: boolean;
}

const variantStyles: Record<Variant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.primary, fg: colors.textOnPrimary },
  accent: { bg: colors.accent, fg: colors.textOnAccent },
  secondary: { bg: colors.surface, fg: colors.primary, border: colors.primary },
  ghost: { bg: "transparent", fg: colors.primary },
  danger: { bg: colors.danger, fg: colors.surface },
};

const sizeStyles: Record<Size, { height: number; font: number; px: number }> = {
  sm: { height: 36, font: fontSize.sm, px: spacing.md },
  md: { height: 46, font: fontSize.md, px: spacing.lg },
  lg: { height: 54, font: fontSize.lg, px: spacing.xl },
};

export function Button({
  title,
  variant = "primary",
  size = "md",
  loading,
  disabled,
  fullWidth,
  left,
  right,
  style,
  haptic = true,
  onPress,
  ...rest
}: Props) {
  const v = variantStyles[variant];
  const s = sizeStyles[size];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      onPress={(e) => {
        if (haptic) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.(e);
      }}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: v.bg,
          height: s.height,
          paddingHorizontal: s.px,
          borderColor: v.border ?? "transparent",
          borderWidth: v.border ? 1.5 : 0,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
          alignSelf: fullWidth ? "stretch" : "flex-start",
        },
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <View style={styles.row}>
          {left}
          <Text style={[styles.label, { color: v.fg, fontSize: s.font }]}>{title}</Text>
          {right}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  label: { fontWeight: fontWeight.semibold },
});
