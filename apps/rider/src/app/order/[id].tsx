import Ionicons from "@expo/vector-icons/Ionicons";
import { STATUS_LABEL, type Order } from "@ration/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { MapOrFallback } from "@/components/MapOrFallback";
import { Button, Screen, Typography } from "@/components/ui";
import { colors, radius, spacing } from "@/constants/theme";
import { RIDER_CAN_DECLINE, RIDER_NEXT, describeRiderError, riderApi } from "@/lib/api";
import { queryKeys } from "@/lib/query";
import { supabase } from "@/lib/supabase";
import { formatInr } from "@ration/shared";

const ORDER_COLUMNS = "id, order_number, user_id, store_id, status, payment_method, subtotal, discount, delivery_fee, handling_fee, tip, total, coupon_code, promised_at, delivered_at, cancelled_at, cancel_reason, rider_id, customer_note, address_snapshot, created_at, order_items(id, product_id, name, unit_label, image_url, quantity, unit_price, mrp, line_total)";

const STEP_LABEL: Record<string, string> = { picked_up: "Picked up from store", out_for_delivery: "Start delivery", delivered: "Delivered to customer" };

export default function RiderOrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const order = useQuery({
    queryKey: queryKeys.order(id),
    queryFn: async () => {
      const { data, error: e } = await supabase.from("orders").select(ORDER_COLUMNS).eq("id", id).maybeSingle();
      if (e) throw e;
      return data as unknown as Order | null;
    },
    enabled: !!id,
  });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: queryKeys.order(id) });
    void qc.invalidateQueries({ queryKey: queryKeys.active });
    void qc.invalidateQueries({ queryKey: queryKeys.summary });
  };
  const advance = useMutation({ mutationFn: (s: keyof typeof STEP_LABEL) => riderApi.advance(id, s as Order["status"]), onSuccess: refresh, onError: (e) => setError(describeRiderError(e)) });
  const decline = useMutation({
    mutationFn: (reason: string) => riderApi.decline(id, reason),
    onSuccess: () => {
      refresh();
      void qc.invalidateQueries({ queryKey: queryKeys.pool });
      if (router.canGoBack()) router.back();
      else router.replace("/(tabs)");
    },
    onError: (e) => setError(describeRiderError(e)),
  });
  const askDecline = () =>
    // Android shows at most three alert buttons.
    Alert.alert("Decline this delivery?", "It will go to the next available partner and won't come back to you.", [
      { text: "Keep it", style: "cancel" },
      { text: "Vehicle problem", onPress: () => decline.mutate("Vehicle problem") },
      { text: "Other reason", style: "destructive", onPress: () => decline.mutate("Other") },
    ]);

  const o = order.data;
  if (order.isLoading) return <Screen><ActivityIndicator color={colors.primary} /></Screen>;
  if (!o) return <Screen><Typography tone="muted">This order is no longer available.</Typography></Screen>;
  const a = o.address_snapshot;
  const next = RIDER_NEXT[o.status];
  const phone = a.recipient_phone;
  const navigate = () => {
    const url = Platform.select({ ios: `maps://?daddr=${a.lat},${a.lng}&dirflg=d`, default: `geo:${a.lat},${a.lng}?q=${a.lat},${a.lng}(Customer)` });
    Linking.openURL(url!).catch(() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${a.lat},${a.lng}`));
  };

  return (
    <Screen padded={false} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))} hitSlop={12}><Ionicons name="arrow-back" size={24} color={colors.text} /></Pressable>
        <Typography variant="heading">Order #{o.order_number}</Typography>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.statusRow}>
          <View style={styles.badge}><Typography variant="label" weight="semibold" style={{ color: colors.primary }}>{STATUS_LABEL[o.status]}</Typography></View>
          {o.promised_at ? <Typography variant="caption" tone="muted">Deliver by {new Date(o.promised_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</Typography> : null}
        </View>

        {o.status === "accepted" || o.status === "packing" ? (
          <View style={styles.note}>
            <Typography variant="label" weight="semibold">Head to the store</Typography>
            <Typography variant="caption" tone="muted">This order was assigned to you while it is being packed. Pick it up as soon as it is ready.</Typography>
          </View>
        ) : null}

        {o.status !== "delivered" && o.status !== "cancelled" ? <MapOrFallback destination={{ lat: a.lat, lng: a.lng }} /> : null}

        <View style={styles.card}>
          <Typography variant="heading">{a.recipient_name || "Customer"}</Typography>
          <Typography tone="muted">{[a.line1, a.line2, a.landmark, a.city, a.pincode].filter(Boolean).join(", ")}</Typography>
          {o.customer_note ? <View style={styles.note}><Typography variant="caption">Note: {o.customer_note}</Typography></View> : null}
          <View style={styles.actions}>
            <Button title="Navigate" variant="primary" left={<Ionicons name="navigate" size={16} color={colors.textOnPrimary} />} onPress={navigate} style={{ flex: 1 }} />
            <Button title="Call" variant="secondary" left={<Ionicons name="call" size={16} color={colors.primary} />} disabled={!phone} onPress={() => phone && Linking.openURL(`tel:${phone}`)} style={{ flex: 1 }} />
          </View>
        </View>

        <View style={styles.card}>
          <Typography variant="heading">{o.order_items.length} {o.order_items.length === 1 ? "item" : "items"}</Typography>
          {o.order_items.map((i) => (
            <View key={i.id} style={styles.item}><Typography variant="label" style={{ flex: 1 }}>{i.name} <Typography variant="caption" tone="muted">· {i.unit_label}</Typography></Typography><Typography variant="label" weight="bold">× {i.quantity}</Typography></View>
          ))}
          <View style={[styles.item, { borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: spacing.sm }]}>
            <Typography variant="label" weight="bold" style={{ flex: 1 }}>{o.payment_method === "cod" ? "Collect cash" : "Already paid"}</Typography>
            <Typography variant="heading" style={{ color: o.payment_method === "cod" ? colors.goldText : colors.success }}>{o.payment_method === "cod" ? formatInr(o.total) : "✓"}</Typography>
          </View>
          {o.tip > 0 ? <Typography variant="caption" tone="success">Customer added a tip of {formatInr(o.tip)}</Typography> : null}
        </View>

        {error ? <Typography variant="label" tone="danger">{error}</Typography> : null}
        {next ? (
          <Button
            title={STEP_LABEL[next]}
            variant="accent"
            size="lg"
            fullWidth
            loading={advance.isPending}
            onPress={() => {
              setError(null);
              if (next === "delivered" && o.payment_method === "cod") {
                Alert.alert("Cash collected?", `Confirm you received ${formatInr(o.total)} from the customer.`, [{ text: "Not yet", style: "cancel" }, { text: "Yes, delivered", onPress: () => advance.mutate(next) }]);
              } else advance.mutate(next);
            }}
          />
        ) : null}
        {RIDER_CAN_DECLINE.includes(o.status) ? <Button title="Decline delivery" variant="ghost" fullWidth loading={decline.isPending} onPress={askDecline} /> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  body: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl },
  statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  badge: { backgroundColor: colors.primaryTint, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.xs },
  note: { backgroundColor: colors.accentTint, borderRadius: radius.sm, padding: spacing.sm, marginTop: spacing.xs },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  item: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xs },
});
