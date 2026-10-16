import { StyleSheet, View } from "react-native";

import { Typography } from "@/components/ui";
import { colors, radius, spacing } from "@/constants/theme";
import { formatInr, type Bill } from "@ration/shared";

function Row({ label, value, strike, tone }: { label: string; value: string; strike?: boolean; tone?: "muted" | "success" | "default" }) {
  return (
    <View style={styles.row}>
      <Typography variant="label" tone={tone ?? "muted"}>{label}</Typography>
      <Typography variant="label" tone={tone ?? "default"} style={strike ? styles.strike : undefined}>{value}</Typography>
    </View>
  );
}

export function BillSummary({ bill }: { bill: Bill }) {
  return (
    <View style={styles.card}>
      <Typography variant="heading" style={{ marginBottom: spacing.sm }}>Bill details</Typography>
      <Row label="Items total" value={formatInr(bill.subtotal)} />
      {bill.item_savings > 0 ? <Row label="Savings on MRP" value={`-${formatInr(bill.item_savings)}`} tone="success" /> : null}
      {bill.discount > 0 ? <Row label={`Coupon ${bill.coupon_code ?? ""}`.trim()} value={`-${formatInr(bill.discount)}`} tone="success" /> : null}
      <Row label="Delivery fee" value={bill.delivery_fee === 0 ? "FREE" : formatInr(bill.delivery_fee)} tone={bill.delivery_fee === 0 ? "success" : "default"} />
      {bill.small_order_fee > 0 ? <Row label="Small order fee" value={formatInr(bill.small_order_fee)} /> : null}
      <Row label="Handling fee" value={formatInr(bill.handling_fee)} />
      {bill.tip > 0 ? <Row label="Delivery partner tip" value={formatInr(bill.tip)} /> : null}
      <View style={styles.divider} />
      <View style={styles.row}>
        <Typography variant="heading">To pay</Typography>
        <Typography variant="heading">{formatInr(bill.total)}</Typography>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.sm },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  divider: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.xs },
  strike: { textDecorationLine: "line-through" },
});
