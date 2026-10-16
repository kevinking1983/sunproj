import Ionicons from "@expo/vector-icons/Ionicons";
import { FlashList } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from "react-native";

import { CartBar } from "@/components/cart/CartBar";
import { ProductRow } from "@/components/catalog/ProductRow";
import { Screen, Typography } from "@/components/ui";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { catalogApi } from "@/lib/api/catalog";
import { queryKeys } from "@/lib/query";
import { useLocation } from "@/stores/location";

const SUGGESTIONS = ["Milk", "Bread", "Atta", "Rice", "Eggs", "Chips", "Onion", "Juice"];

export default function SearchScreen() {
  const storeId = useLocation((s) => s.store?.id ?? "");
  const [text, setText] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(text.trim()), 250);
    return () => clearTimeout(t);
  }, [text]);

  const results = useQuery({
    queryKey: queryKeys.search(storeId, debounced),
    queryFn: () => catalogApi.search(storeId, debounced),
    enabled: !!storeId && debounced.length >= 2,
  });

  return (
    <Screen padded={false} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.field}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Search for products"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            autoFocus
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Search products"
          />
          {text ? (
            <Pressable onPress={() => setText("")} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {debounced.length < 2 ? (
        <View style={styles.suggestions}>
          <Typography variant="label" tone="muted">POPULAR SEARCHES</Typography>
          <View style={styles.chips}>
            {SUGGESTIONS.map((s) => (
              <Pressable key={s} onPress={() => setText(s)} style={styles.chip}>
                <Typography variant="label">{s}</Typography>
              </Pressable>
            ))}
          </View>
        </View>
      ) : results.isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxl }} />
      ) : (
        <FlashList
          data={results.data ?? []}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => <ProductRow product={item} />}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 120 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Typography variant="heading" center>No results for “{debounced}”</Typography>
              <Typography tone="muted" center>Try a different spelling or browse categories.</Typography>
            </View>
          }
        />
      )}
      <CartBar />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  field: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm, height: 46, paddingHorizontal: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  input: { flex: 1, fontSize: fontSize.md, color: colors.text },
  suggestions: { padding: spacing.lg, gap: spacing.md },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  sep: { height: 1, backgroundColor: colors.divider },
  empty: { marginTop: spacing.xxxl, padding: spacing.lg, gap: spacing.sm },
});
