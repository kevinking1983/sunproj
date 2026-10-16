import { StyleSheet, Text, type TextProps } from "react-native";

import { colors, fontSize, fontWeight } from "@/constants/theme";

type Variant = "display" | "title" | "heading" | "body" | "label" | "caption";
type Tone = "default" | "muted" | "onPrimary" | "onDark" | "accent" | "danger" | "success";

interface Props extends TextProps {
  variant?: Variant;
  tone?: Tone;
  weight?: keyof typeof fontWeight;
  center?: boolean;
}

const toneColor: Record<Tone, string> = {
  default: colors.text,
  muted: colors.textMuted,
  onPrimary: colors.textOnPrimary,
  onDark: colors.textOnDark,
  accent: colors.goldText,
  danger: colors.danger,
  success: colors.success,
};

export function Typography({ variant = "body", tone = "default", weight, center, style, ...rest }: Props) {
  return (
    <Text
      {...rest}
      style={[
        styles[variant],
        { color: toneColor[tone] },
        weight ? { fontWeight: fontWeight[weight] } : null,
        center ? { textAlign: "center" } : null,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  display: { fontSize: fontSize.display, fontWeight: fontWeight.bold, lineHeight: 36 },
  title: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, lineHeight: 30 },
  heading: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, lineHeight: 24 },
  body: { fontSize: fontSize.md, fontWeight: fontWeight.regular, lineHeight: 22 },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, lineHeight: 18 },
  caption: { fontSize: fontSize.xs, fontWeight: fontWeight.regular, lineHeight: 16 },
});
