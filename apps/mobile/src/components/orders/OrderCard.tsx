import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { Typography } from "@/components/ui";
import { colors, radius, spacing } from "@/constants/theme";
import type { Order } from "@/lib/api/orders";
import { formatInr } from "@ration/shared";

import { isActive, STATUS_LABEL } from "./status";

export function OrderCard({ order }: { order: Order }) {
  const active = isActive(order.status);
  const cancelled = order.status === "cancelled" || order.status === "refunded";
  const summary = order.order_items.map((i) => `${i.name} × ${i.quantity}`).join(", ");
  return (
    <Pressable onPress={() => router.push({ pathname: "/order/[id]", params: { id: order.id } })} style={styles.card}>
      <View style={styles.top}>
        <View style={[styles.dot, { backgroundColor: cancelled ? colors.danger : active ? colors.accent : colors.success }]} />
        <Typography variant="label" weight="semibold" style={{ flex: 1 }}>{STATUS_LABEL[order.status]}</Typography>
        <Typography variant="caption" tone="muted">{new Date(order.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</Typography>
      </View>
      <Typography variant="caption" tone="muted" numberOfLines={2}>{summary}</Typography>
      <View style={styles.bottom}>
        <Typography variant="caption" tone="muted">#{order.order_number}</Typography>
        <View style={styles.amount}>
          <Typography variant="label" weight="bold">{formatInr(order.total)}</Typography>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.xs },
  top: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  bottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.xs },
  amount: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
});
