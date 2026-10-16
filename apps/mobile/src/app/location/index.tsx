import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from "react-native";

import { Screen, TextField, Typography } from "@/components/ui";
import { colors, radius, spacing } from "@/constants/theme";
import { addressesApi, type Address } from "@/lib/api/addresses";
import { maps, type PlaceSuggestion } from "@/lib/maps";
import { queryKeys } from "@/lib/query";
import { useAuth } from "@/stores/auth";
import { useLocation } from "@/stores/location";

const labelIcon: Record<Address["label"], keyof typeof Ionicons.glyphMap> = {
  home: "home-outline",
  work: "briefcase-outline",
  other: "location-outline",
};

export default function LocationScreen() {
  const userId = useAuth((s) => s.session?.user.id ?? "");
  const { detectLocation, selectSavedAddress, setLocation, status, error, location } = useLocation();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);

  const addresses = useQuery({ queryKey: queryKeys.addresses(userId), queryFn: addressesApi.list, enabled: !!userId });

  useEffect(() => {
    if (query.trim().length < 3) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await maps.autocomplete(query, location ?? undefined);
        if (!cancelled) setSuggestions(res);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, location]);

  const showSuggestions = query.trim().length >= 3 && suggestions.length > 0;

  const finish = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  };

  const onDevice = async () => {
    setBusy(true);
    const ok = await detectLocation();
    setBusy(false);
    if (ok) router.push("/location/confirm");
  };

  const onSuggestion = async (s: PlaceSuggestion) => {
    setBusy(true);
    try {
      const resolved = await maps.placeDetails(s.id);
      await setLocation(resolved);
      router.push("/location/confirm");
    } finally {
      setBusy(false);
    }
  };

  const onSaved = async (a: Address) => {
    setBusy(true);
    await selectSavedAddress(a);
    setBusy(false);
    finish();
  };

  return (
    <Screen edges={["top", "bottom"]} padded={false}>
      <View style={styles.header}>
        <Pressable onPress={finish} hitSlop={12} disabled={!location}>
          <Ionicons name="close" size={26} color={location ? colors.text : colors.border} />
        </Pressable>
        <Typography variant="heading">Set delivery location</Typography>
        <View style={{ width: 26 }} />
      </View>

      <View style={styles.search}>
        <TextField
          placeholder="Search for area, street name..."
          value={query}
          onChangeText={setQuery}
          prefix={<Ionicons name="search" size={18} color={colors.textMuted} />}
          suffix={searching ? <ActivityIndicator size="small" color={colors.primary} /> : undefined}
          autoCorrect={false}
        />
      </View>

      {showSuggestions ? (
        <FlatList
          data={suggestions}
          keyExtractor={(s) => s.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Pressable onPress={() => onSuggestion(item)} style={styles.row}>
              <Ionicons name="location-outline" size={20} color={colors.textMuted} />
              <View style={styles.rowBody}>
                <Typography weight="medium">{item.title}</Typography>
                <Typography variant="caption" tone="muted" numberOfLines={1}>{item.subtitle}</Typography>
              </View>
            </Pressable>
          )}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
        />
      ) : (
        <FlatList
          data={addresses.data ?? []}
          keyExtractor={(a) => a.id}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View>
              <Pressable onPress={onDevice} style={styles.current} disabled={busy}>
                <View style={styles.currentIcon}>
                  {busy || status === "resolving" ? <ActivityIndicator color={colors.primary} /> : <Ionicons name="navigate" size={20} color={colors.primary} />}
                </View>
                <View style={styles.rowBody}>
                  <Typography weight="semibold" style={{ color: colors.primary }}>Use my current location</Typography>
                  <Typography variant="caption" tone="muted">Using GPS</Typography>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
              {error ? <Typography variant="caption" tone="danger" style={styles.error}>{error}</Typography> : null}
              {addresses.data?.length ? <Typography variant="label" tone="muted" style={styles.section}>SAVED ADDRESSES</Typography> : null}
            </View>
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => onSaved(item)} style={styles.row} disabled={busy}>
              <Ionicons name={labelIcon[item.label]} size={20} color={colors.textMuted} />
              <View style={styles.rowBody}>
                <Typography weight="medium">{item.label === "other" ? item.line1 : item.label.charAt(0).toUpperCase() + item.label.slice(1)}</Typography>
                <Typography variant="caption" tone="muted" numberOfLines={2}>
                  {[item.line1, item.line2, item.city, item.pincode].filter(Boolean).join(", ")}
                </Typography>
              </View>
              <Pressable onPress={() => router.push({ pathname: "/location/form", params: { id: item.id } })} hitSlop={10}>
                <Ionicons name="create-outline" size={20} color={colors.textMuted} />
              </Pressable>
            </Pressable>
          )}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          ListEmptyComponent={
            addresses.isLoading ? undefined : (
              <Typography tone="muted" center style={{ marginTop: spacing.xxl }}>
                No saved addresses yet. Use your location or search above.
              </Typography>
            )
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  search: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  current: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  currentIcon: { width: 36, height: 36, borderRadius: radius.pill, backgroundColor: colors.primaryTint, alignItems: "center", justifyContent: "center" },
  section: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm, letterSpacing: 0.6 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  rowBody: { flex: 1, gap: 2 },
  sep: { height: 1, backgroundColor: colors.divider, marginLeft: spacing.lg + 20 + spacing.md },
  error: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
});
