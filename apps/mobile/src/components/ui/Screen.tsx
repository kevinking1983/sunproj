import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type ViewStyle } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

import { colors, spacing } from "@/constants/theme";

interface Props {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  edges?: Edge[];
  background?: string;
  style?: ViewStyle;
  keyboard?: boolean;
}

export function Screen({ children, scroll, padded = true, edges = ["top"], background = colors.background, style, keyboard }: Props) {
  const content = scroll ? (
    <ScrollView contentContainerStyle={[padded && styles.padded, style]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.fill, padded && styles.padded, style]}>{children}</View>
  );
  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: background }]} edges={edges}>
      {keyboard ? (
        <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          {content}
        </KeyboardAvoidingView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  padded: { padding: spacing.lg },
});
