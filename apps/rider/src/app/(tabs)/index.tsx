import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { RefreshControl, ScrollView, StyleSheet, Switch, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { OrderTile } from "@/components/OrderTile";
import { Typography } from "@/components/ui";
import { colors, radius, spacing } from "@/constants/theme";
import { riderApi } from "@/lib/api";
import { queryKeys } from "@/lib/query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/stores/auth";
import { useRider } from "@/stores/rider";
import { formatInr } from "@ration/shared";

export default function DeliveriesScreen() {
  const qc = useQueryClient();
  const profile = useAuth((s) => s.profile);
  const { online, busy, error, setOnline, hydrate } = useRider();
  const summary = useQuery({ queryKey: queryKeys.summary, queryFn: riderApi.summary, refetchInterval: 60_000 });
  const active = useQuery({ queryKey: queryKeys.active, queryFn: riderApi.myActive, refetchInterval: 20_000 });

  useEffect(() => {
    if (summary.data) hydrate(summary.data.is_online);
  }, [summary.data, hydrate]);

  useEffect(() => {
    const ch = supabase
      .channel("rider-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        void qc.invalidateQueries({ queryKey: queryKeys.active });
        void qc.invalidateQueries({ queryKey: queryKeys.pool });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [qc]);

  const s = summary.data;
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Typography variant="caption" tone="onDark" style={{ opacity: 0.8 }}>Hello{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}</Typography>
          <Typography variant="title" tone="onDark">{online ? "You are online" : "You are offline"}</Typography>
          {error ? <Typography variant="caption" style={{ color: colors.accent }}>{error}</Typography> : null}
        </View>
        <Switch value={online} disabled={busy} onValueChange={(v) => void setOnline(v)} trackColor={{ true: colors.accent, false: colors.textMuted }} thumbColor={colors.surface} accessibilityLabel="Online toggle" />
      </View>
      <ScrollView contentContainerStyle={styles.body} refreshControl={<RefreshControl refreshing={active.isFetching} onRefresh={() => { void active.refetch(); void summary.refetch(); }} tintColor={colors.primary} />}>
        <View style={styles.tiles}>
          {[["Delivered today", String(s?.delivered_today ?? 0)], ["Tips today", formatInr(s?.tips_today ?? 0)], ["Cash to deposit", formatInr(s?.cod_collected_today ?? 0)]].map(([l, v]) => (
            <View key={l} style={styles.tile}><Typography variant="caption" tone="muted">{l}</Typography><Typography variant="heading">{v}</Typography></View>
          ))}
        </View>
        <Typography variant="heading" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>Your deliveries</Typography>
        {(active.data ?? []).map((o) => <View key={o.id} style={{ marginBottom: spacing.sm }}><OrderTile order={o} /></View>)}
        {active.data?.length === 0 ? (
          <View style={styles.empty}>
            <Typography tone="muted" center>{online ? "No deliveries yet. Orders near you are assigned automatically, or pick one from the Available tab." : "Go online to receive deliveries."}</Typography>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.primaryDark },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  body: { backgroundColor: colors.background, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: 100, minHeight: "100%" },
  tiles: { flexDirection: "row", gap: spacing.sm },
  tile: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: 2 },
  empty: { padding: spacing.xl, alignItems: "center" },
});
