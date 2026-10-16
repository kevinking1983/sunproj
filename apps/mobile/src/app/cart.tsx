import Ionicons from "@expo/vector-icons/Ionicons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BillSummary } from "@/components/checkout/BillSummary";
import { CartLineRow } from "@/components/checkout/CartLineRow";
import { OptionCard } from "@/components/checkout/OptionCard";
import { Button, Screen, TextField, Typography } from "@/components/ui";
import { colors, radius, spacing } from "@/constants/theme";
import { couponsApi } from "@/lib/api/coupons";
import { coerceOrderError, ordersApi, type PlaceOrderResult } from "@/lib/api/orders";
import { openRazorpayCheckout, PaymentCancelled } from "@/lib/payments";
import { queryKeys } from "@/lib/query";
import { useAuth } from "@/stores/auth";
import { selectLines, useCart } from "@/stores/cart";
import { useLocation } from "@/stores/location";
import { computeBill, formatInr, type PaymentMethod } from "@ration/shared";

type PayChoice = "online" | "cod" | "ration_wallet";
const TIPS = [0, 1000, 2000, 3000];

const newIdempotencyKey = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const lines = useCart(selectLines);
  const { couponCode, tip, setCoupon, setTip, clear } = useCart();
  const { location, store, status } = useLocation();
  const profile = useAuth((s) => s.profile);
  const userId = useAuth((s) => s.session?.user.id ?? "");

  const [pay, setPay] = useState<PayChoice>("online");
  const [couponInput, setCouponInput] = useState(couponCode ?? "");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const idempotencyKey = useRef(newIdempotencyKey());

  const coupons = useQuery({ queryKey: queryKeys.coupons, queryFn: couponsApi.list });
  const coupon = useMemo(() => coupons.data?.find((c) => c.code.toUpperCase() === (couponCode ?? "").toUpperCase()) ?? null, [coupons.data, couponCode]);

  const bill = useMemo(
    () => computeBill(lines, store ?? { min_order_amount: 0, delivery_fee: 0, free_delivery_above: 0 }, coupon, tip),
    [lines, store, coupon, tip],
  );

  const walletBalance = profile?.wallet_balance ?? 0;
  const addressId = location?.addressId ?? null;
  const serviceable = status === "ready" && !!store;
  const belowMinimum = store ? bill.subtotal < store.min_order_amount : false;

  const place = useMutation({
    mutationFn: async (): Promise<{ orderId: string; paid: boolean }> => {
      if (!store || !addressId) throw new Error("Choose a saved delivery address first.");
      const method: PaymentMethod = pay === "online" ? "upi" : pay;
      const result: PlaceOrderResult = await ordersApi.place(
        {
          store_id: store.id,
          address_id: addressId,
          items: lines.map((l) => ({ product_id: l.productId, quantity: l.quantity })),
          payment_method: method,
          coupon_code: bill.coupon_code,
          tip,
          note: note.trim() || null,
        },
        idempotencyKey.current,
      );
      if (result.checkout) {
        try {
          const success = await openRazorpayCheckout(result.checkout);
          await ordersApi.verifyPayment({ order_id: result.order_id, ...success });
          return { orderId: result.order_id, paid: true };
        } catch (e) {
          if (e instanceof PaymentCancelled) {
            await ordersApi.cancel(result.order_id, "Payment cancelled").catch(() => undefined);
            idempotencyKey.current = newIdempotencyKey();
            throw new Error("Payment was cancelled. Your order was not placed.");
          }
          throw e;
        }
      }
      return { orderId: result.order_id, paid: true };
    },
    onSuccess: ({ orderId }) => {
      clear();
      void qc.invalidateQueries({ queryKey: queryKeys.orders(userId) });
      void useAuth.getState().refreshProfile();
      router.replace({ pathname: "/order/[id]", params: { id: orderId, placed: "1" } });
    },
    onError: (e) => {
      const message = coerceOrderError(e);
      setError(message);
      if (!(e instanceof Error && /cancelled/i.test(e.message))) idempotencyKey.current = newIdempotencyKey();
    },
  });

  const applyCoupon = () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return setCoupon(null);
    const match = coupons.data?.find((c) => c.code.toUpperCase() === code);
    if (!match) return setError("That coupon code is not valid.");
    setError(null);
    setCoupon(match.code);
  };

  const canPlace = serviceable && lines.length > 0 && !!addressId && !place.isPending && (pay !== "ration_wallet" || walletBalance >= bill.total);

  const confirmPlace = () => {
    if (!addressId) {
      Alert.alert("Save your address", "We need a saved address with your house or flat number to deliver.", [
        { text: "Cancel", style: "cancel" },
        { text: "Add address", onPress: () => router.push("/location/form") },
      ]);
      return;
    }
    setError(null);
    place.mutate();
  };

  if (lines.length === 0) {
    return (
      <Screen edges={["top", "bottom"]}>
        <Header />
        <View style={styles.empty}>
          <Ionicons name="cart-outline" size={56} color={colors.primaryLight} />
          <Typography variant="heading">Your cart is empty</Typography>
          <Typography tone="muted" center>Add fresh groceries and we will bring them to your door in minutes.</Typography>
          <Button title="Start shopping" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={["top"]} padded={false}>
      <Header />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 140 + insets.bottom }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {store ? (
          <View style={styles.eta}>
            <Ionicons name="time-outline" size={18} color={colors.primary} />
            <Typography variant="label" weight="semibold">Delivery in {store.promised_minutes} minutes</Typography>
            <Typography variant="caption" tone="muted">· {lines.length} {lines.length === 1 ? "item" : "items"}</Typography>
          </View>
        ) : null}

        <View style={styles.card}>
          {lines.map((l, i) => (
            <View key={l.productId}>
              <CartLineRow line={l} />
              {i < lines.length - 1 ? <View style={styles.sep} /> : null}
            </View>
          ))}
        </View>

        {belowMinimum && store ? (
          <View style={styles.notice}>
            <Typography variant="caption" tone="accent">Add {formatInr(store.min_order_amount - bill.subtotal)} more to avoid the small order fee.</Typography>
          </View>
        ) : null}

        <Typography variant="heading" style={styles.section}>Coupon</Typography>
        <View style={styles.couponRow}>
          <View style={{ flex: 1 }}>
            <TextField placeholder="Enter coupon code" autoCapitalize="characters" autoCorrect={false} value={couponInput} onChangeText={setCouponInput} error={bill.coupon_error} />
          </View>
          <Button title={couponCode ? "Remove" : "Apply"} variant="secondary" onPress={couponCode ? () => { setCoupon(null); setCouponInput(""); } : applyCoupon} />
        </View>
        {coupons.data?.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {coupons.data.map((c) => (
              <Pressable key={c.id} onPress={() => { setCouponInput(c.code); setCoupon(c.code); setError(null); }} style={[styles.chip, couponCode === c.code && styles.chipActive]}>
                <Typography variant="caption" weight="bold" style={{ color: couponCode === c.code ? colors.textOnPrimary : colors.primary }}>{c.code}</Typography>
                <Typography variant="caption" style={{ color: couponCode === c.code ? colors.textOnPrimary : colors.textMuted }}>{c.title}</Typography>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        <Typography variant="heading" style={styles.section}>Tip your delivery partner</Typography>
        <View style={styles.chips}>
          {TIPS.map((t) => (
            <Pressable key={t} onPress={() => setTip(t)} style={[styles.chip, tip === t && styles.chipActive]}>
              <Typography variant="label" style={{ color: tip === t ? colors.textOnPrimary : colors.text }}>{t === 0 ? "No tip" : formatInr(t)}</Typography>
            </Pressable>
          ))}
        </View>

        <Typography variant="heading" style={styles.section}>Deliver to</Typography>
        <OptionCard
          icon="location-outline"
          title={location ? location.label : "Choose address"}
          subtitle={addressId ? location?.line1 : "Save an address with your house or flat number"}
          selected={!!addressId}
          onPress={() => router.push("/location")}
          right={<Typography variant="label" weight="semibold" style={{ color: colors.primary }}>Change</Typography>}
        />
        {!addressId ? (
          <Button title="Add house / flat details" variant="ghost" onPress={() => router.push("/location/form")} style={{ marginTop: spacing.xs }} />
        ) : null}

        <Typography variant="heading" style={styles.section}>Payment</Typography>
        <View style={styles.options}>
          <OptionCard icon="phone-portrait-outline" title="Pay online" subtitle="UPI, cards, netbanking and wallets via Razorpay" selected={pay === "online"} onPress={() => setPay("online")} />
          <OptionCard icon="cash-outline" title="Cash on delivery" subtitle="Pay the delivery partner when your order arrives" selected={pay === "cod"} onPress={() => setPay("cod")} />
          <OptionCard
            icon="wallet-outline"
            title="RATION wallet"
            subtitle={`Balance ${formatInr(walletBalance)}${walletBalance < bill.total ? " · not enough for this order" : ""}`}
            selected={pay === "ration_wallet"}
            disabled={walletBalance < bill.total}
            onPress={() => setPay("ration_wallet")}
          />
        </View>

        <Typography variant="heading" style={styles.section}>Delivery instructions</Typography>
        <TextField placeholder="e.g. Leave at the door, call on arrival" value={note} onChangeText={setNote} maxLength={200} />

        <View style={styles.section}>
          <BillSummary bill={bill} />
        </View>

        {error ? <Typography variant="label" tone="danger" style={{ marginTop: spacing.md }}>{error}</Typography> : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <View>
          <Typography variant="caption" tone="muted">To pay</Typography>
          <Typography variant="heading">{formatInr(bill.total)}</Typography>
        </View>
        <Button
          title={pay === "online" ? "Pay and place order" : "Place order"}
          variant="accent"
          size="lg"
          loading={place.isPending}
          disabled={!canPlace && !!addressId}
          onPress={confirmPlace}
          style={{ flex: 1, marginLeft: spacing.lg }}
        />
      </View>
    </Screen>
  );
}

function Header() {
  return (
    <View style={styles.header}>
      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))} hitSlop={12}>
        <Ionicons name="close" size={26} color={colors.text} />
      </Pressable>
      <Typography variant="heading">Checkout</Typography>
      <View style={{ width: 26 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  scroll: { paddingHorizontal: spacing.lg },
  eta: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginBottom: spacing.md },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md },
  sep: { height: 1, backgroundColor: colors.divider },
  notice: { marginTop: spacing.sm, padding: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.accentTint },
  section: { marginTop: spacing.xl, marginBottom: spacing.sm },
  couponRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  chips: { flexDirection: "row", gap: spacing.sm, paddingVertical: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: "center" },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  options: { gap: spacing.sm },
  footer: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: spacing.lg, paddingTop: spacing.md,
    backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border,
  },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl },
});
