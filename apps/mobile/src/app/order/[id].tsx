import Ionicons from "@expo/vector-icons/Ionicons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { BillSummary } from "@/components/checkout/BillSummary";
import { ProductImage } from "@/components/catalog/ProductImage";
import { RateItem } from "@/components/orders/RateItem";
import { isActive, isCancellable, STATUS_LABEL, STATUS_STEPS, stepIndex } from "@/components/orders/status";
import { Button, Screen, Typography } from "@/components/ui";
import { colors, radius, spacing } from "@/constants/theme";
import { coerceOrderError, ordersApi, type Order } from "@/lib/api/orders";
import { queryKeys } from "@/lib/query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/stores/auth";
import { useCart } from "@/stores/cart";
import { useLocation } from "@/stores/location";
import { formatInr, type Bill } from "@ration/shared";

const toBill = (o: Order): Bill => ({
  subtotal: o.subtotal,
  mrp_total: o.order_items.reduce((n, i) => n + i.mrp * i.quantity, 0),
  item_savings: o.order_items.reduce((n, i) => n + (i.mrp - i.unit_price) * i.quantity, 0),
  discount: o.discount,
  delivery_fee: o.delivery_fee,
  small_order_fee: 0,
  handling_fee: o.handling_fee,
  tip: o.tip,
  total: o.total,
  coupon_code: o.coupon_code,
  coupon_error: null,
});

export default function OrderScreen() {
  const { id, placed } = useLocalSearchParams<{ id: string; placed?: string }>();
  const qc = useQueryClient();
  const userId = useAuth((s) => s.session?.user.id ?? "");
  const order = useQuery({ queryKey: queryKeys.order(id), queryFn: () => ordersApi.get(id), enabled: !!id });

  // Live status: the orders table is in the realtime publication and RLS scopes it to the owner.
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`order-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${id}` }, () => {
        void qc.invalidateQueries({ queryKey: queryKeys.order(id) });
        void qc.invalidateQueries({ queryKey: queryKeys.orders(userId) });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id, qc, userId]);

  const cancel = useMutation({
    mutationFn: () => ordersApi.cancel(id, "Cancelled by customer"),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.order(id) });
      void qc.invalidateQueries({ queryKey: queryKeys.orders(userId) });
      void useAuth.getState().refreshProfile();
    },
    onError: (e) => Alert.alert("Could not cancel", coerceOrderError(e)),
  });

  const o = order.data;
  const back = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)/orders"));

  const reorder = () => {
    if (!o) return;
    const storeId = useLocation.getState().store?.id;
    if (!storeId) return router.push("/location");
    const add = useCart.getState().add;
    for (const item of o.order_items) {
      add(
        { id: item.product_id, slug: "", name: item.name, description: null, unit_label: item.unit_label, mrp: item.mrp, price: item.unit_price, images: item.image_url ? [item.image_url] : [], is_veg: null, category_id: "", brand_name: null, available: 50 },
        storeId,
      );
      for (let i = 1; i < item.quantity; i++) useCart.getState().increment(item.product_id);
    }
    router.push("/cart");
  };

  return (
    <Screen padded={false} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={back} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Typography variant="heading">{o ? `Order #${o.order_number}` : "Order"}</Typography>
        <View style={{ width: 24 }} />
      </View>

      {order.isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxl }} />
      ) : !o ? (
        <Typography tone="muted" center style={{ marginTop: spacing.xxl }}>We could not find this order.</Typography>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {placed === "1" ? (
            <View style={styles.success}>
              <Ionicons name="checkmark-circle" size={28} color={colors.success} />
              <View style={{ flex: 1 }}>
                <Typography weight="semibold" tone="success">Order placed</Typography>
                <Typography variant="caption" tone="muted">We have sent it to {`the store`}. Sit tight.</Typography>
              </View>
            </View>
          ) : null}

          <View style={styles.card}>
            <Typography variant="title">{STATUS_LABEL[o.status]}</Typography>
            {isActive(o.status) && o.promised_at ? (
              <Typography tone="muted">Arriving by {new Date(o.promised_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</Typography>
            ) : o.delivered_at ? (
              <Typography tone="muted">Delivered at {new Date(o.delivered_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</Typography>
            ) : o.cancel_reason ? (
              <Typography tone="muted">{o.cancel_reason}</Typography>
            ) : null}

            {isActive(o.status) || o.status === "delivered" ? (
              <View style={styles.steps}>
                {STATUS_STEPS.map((s, i) => {
                  const done = stepIndex(o.status) >= i;
                  return (
                    <View key={s} style={styles.step}>
                      <View style={[styles.stepDot, done && styles.stepDone]}>
                        {done ? <Ionicons name="checkmark" size={12} color={colors.textOnPrimary} /> : null}
                      </View>
                      <Typography variant="caption" tone={done ? "default" : "muted"} center numberOfLines={2}>{STATUS_LABEL[s]}</Typography>
                    </View>
                  );
                })}
                <View style={styles.track} />
              </View>
            ) : null}

            {isCancellable(o.status) ? (
              <Button
                title="Cancel order"
                variant="secondary"
                size="sm"
                loading={cancel.isPending}
                onPress={() =>
                  Alert.alert("Cancel this order?", "Any payment made will be refunded to the original method.", [
                    { text: "Keep order", style: "cancel" },
                    { text: "Cancel order", style: "destructive", onPress: () => cancel.mutate() },
                  ])
                }
                style={{ marginTop: spacing.md }}
              />
            ) : null}
          </View>

          <View style={styles.card}>
            <Typography variant="heading" style={{ marginBottom: spacing.sm }}>Delivering to</Typography>
            <Typography variant="label" weight="semibold">{o.address_snapshot.label === "other" ? "Address" : o.address_snapshot.label.charAt(0).toUpperCase() + o.address_snapshot.label.slice(1)}</Typography>
            <Typography variant="caption" tone="muted">{[o.address_snapshot.line1, o.address_snapshot.line2, o.address_snapshot.landmark, o.address_snapshot.city, o.address_snapshot.pincode].filter(Boolean).join(", ")}</Typography>
            {o.customer_note ? <Typography variant="caption" tone="muted" style={{ marginTop: spacing.xs }}>Note: {o.customer_note}</Typography> : null}
          </View>

          <View style={styles.card}>
            <Typography variant="heading" style={{ marginBottom: spacing.sm }}>{o.order_items.length} {o.order_items.length === 1 ? "item" : "items"}</Typography>
            {o.order_items.map((i) => (
              <View key={i.id} style={styles.item}>
                <ProductImage uri={i.image_url} size={44} />
                <View style={{ flex: 1 }}>
                  <Typography variant="label" numberOfLines={2}>{i.name}</Typography>
                  <Typography variant="caption" tone="muted">{i.unit_label} × {i.quantity}</Typography>
                  {o.status === "delivered" ? <RateItem productId={i.product_id} orderId={o.id} /> : null}
                </View>
                <Typography variant="label" weight="semibold">{formatInr(i.line_total)}</Typography>
              </View>
            ))}
          </View>

          <BillSummary bill={toBill(o)} />
          <Typography variant="caption" tone="muted" style={{ marginTop: spacing.sm }}>
            Paid via {o.payment_method === "cod" ? "cash on delivery" : o.payment_method === "ration_wallet" ? "RATION wallet" : "online payment"}
          </Typography>

          <Button title="Reorder these items" variant="primary" fullWidth onPress={reorder} style={{ marginTop: spacing.xl }} />
          <Button title="Need help with this order?" variant="ghost" fullWidth onPress={() => router.push("/(tabs)/account")} />
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md },
  success: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.successTint },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
  steps: { flexDirection: "row", marginTop: spacing.lg, position: "relative" },
  step: { flex: 1, alignItems: "center", gap: spacing.xs, zIndex: 1 },
  stepDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  stepDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  track: { position: "absolute", top: 10, left: "12%", right: "12%", height: 2, backgroundColor: colors.border },
  item: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm },
});
