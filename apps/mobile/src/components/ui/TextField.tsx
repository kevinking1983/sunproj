import { useState } from "react";
import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";

import { colors, fontSize, fontWeight, radius, spacing } from "@/constants/theme";

interface Props extends TextInputProps {
  label?: string;
  error?: string | null;
  hint?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
}

export function TextField({ label, error, hint, prefix, suffix, style, onFocus, onBlur, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.danger : focused ? colors.primary : colors.border;
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.field, { borderColor, borderWidth: focused || error ? 1.5 : 1 }]}>
        {prefix ? <View style={styles.affix}>{prefix}</View> : null}
        <TextInput
          placeholderTextColor={colors.textMuted}
          style={[styles.input, style]}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
        {suffix ? <View style={styles.affix}>{suffix}</View> : null}
      </View>
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  field: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    minHeight: 50,
    paddingHorizontal: spacing.md,
  },
  affix: { justifyContent: "center", marginRight: spacing.sm },
  input: { flex: 1, color: colors.text, fontSize: fontSize.md, paddingVertical: spacing.md },
  error: { color: colors.danger, fontSize: fontSize.xs },
  hint: { color: colors.textMuted, fontSize: fontSize.xs },
});
