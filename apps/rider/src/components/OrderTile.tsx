import Ionicons from "@expo/vector-icons/Ionicons";
import { STATUS_LABEL, type Order } from "@ration/api";
import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { Typography } from "@/components/ui";
import { colors, radius, spacing } from "@/constants/theme";
import { formatInr } from "@ration/shared";

export function OrderTile({ order, action }: { order: Order; action?: React.ReactNode }) {
  const a = order.address_snapshot;
  const items = order.order_items.reduce((n, i) => n + i.quantity, 0);
  return (
    <Pressable onPress={() => router.push({ pathname: "/order/[id]", params: { id: order.id } })} style={styles.tile}>
      <View style={styles.row}>
        <Typography variant="label" weight="bold">#{order.order_number}</Typography>
        <View style={styles.badge}><Typography variant="caption" weight="semibold" style={{ color: colors.primary }}>{STATUS_LABEL[order.status]}</Typography></View>
        <Typography variant="label" weight="semibold" style={{ marginLeft: "auto" }}>{order.payment_method === "cod" ? `Collect ${formatInr(order.total)}` : "Paid"}</Typography>
      </View>
      <View style={[styles.row, { marginTop: spacing.xs }]}>
        <Ionicons name="location-outline" size={16} color={colors.textMuted} />
        <Typography variant="caption" tone="muted" numberOfLines={2} style={{ flex: 1 }}>{[a.line1, a.line2, a.landmark].filter(Boolean).join(", ")}</Typography>
      </View>
      <Typography variant="caption" tone="muted">{items} {items === 1 ? "item" : "items"}{order.tip > 0 ? ` · tip ${formatInr(order.tip)}` : ""}{order.promised_at ? ` · by ${new Date(order.promised_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}` : ""}</Typography>
      {action ? <View style={{ marginTop: spacing.sm }}>{action}</View> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  badge: { backgroundColor: colors.primaryTint, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
});
