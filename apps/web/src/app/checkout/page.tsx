"use client";

import { describeOrderError, type PlaceOrderResult } from "@ration/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { useLocationModal } from "@/components/location/LocationModal";
import { ProductImage } from "@/components/catalog/ProductCard";
import { BillRows } from "@/components/checkout/BillRows";
import { Button, Card, TextField } from "@/components/ui";
import { couponsApi, ordersApi, queryKeys } from "@/lib/api";
import { PaymentCancelled, openCheckout } from "@/lib/payments";
import { useAuth } from "@/stores/auth";
import { useCart, useCartLines } from "@/stores/cart";
import { useLocation } from "@/stores/location";
import { computeBill, formatInr, type PaymentMethod } from "@ration/shared";

type PayChoice = "online" | "cod" | "ration_wallet";
const TIPS = [0, 1000, 2000, 3000];
const newKey = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export default function CheckoutPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const lines = useCartLines();
  const { couponCode, tip, setCoupon, setTip, clear, increment, decrement } = useCart();
  const { location, store, status } = useLocation();
  const openLocation = useLocationModal((s) => s.open);
  const authStatus = useAuth((s) => s.status);
  const profile = useAuth((s) => s.profile);
  const userId = useAuth((s) => s.session?.user.id ?? "");
  const [pay, setPay] = useState<PayChoice>("online");
  const [couponInput, setCouponInput] = useState(couponCode ?? "");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const key = useRef(newKey());

  useEffect(() => {
    if (authStatus === "signed_out") router.replace("/login?next=/checkout");
  }, [authStatus, router]);

  const coupons = useQuery({ queryKey: queryKeys.coupons, queryFn: couponsApi.list });
  const coupon = useMemo(() => coupons.data?.find((c) => c.code.toUpperCase() === (couponCode ?? "").toUpperCase()) ?? null, [coupons.data, couponCode]);
  const bill = useMemo(() => computeBill(lines, store ?? { min_order_amount: 0, delivery_fee: 0, free_delivery_above: 0 }, coupon, tip), [lines, store, coupon, tip]);
  const addressId = location?.addressId ?? null;
  const wallet = profile?.wallet_balance ?? 0;

  const place = useMutation({
    mutationFn: async () => {
      if (!store || !addressId) throw new Error("Choose a saved delivery address first.");
      const method: PaymentMethod = pay === "online" ? "upi" : pay;
      const result: PlaceOrderResult = await ordersApi.place(
        { store_id: store.id, address_id: addressId, items: lines.map((l) => ({ product_id: l.productId, quantity: l.quantity })), payment_method: method, coupon_code: bill.coupon_code, tip, note: note.trim() || null },
        key.current,
      );
      if (result.checkout) {
        try {
          const success = await openCheckout(result.order_id, result.checkout);
          await ordersApi.verifyPayment({ order_id: result.order_id, ...success });
        } catch (e) {
          if (e instanceof PaymentCancelled) {
            await ordersApi.cancel(result.order_id, "Payment cancelled").catch(() => undefined);
            key.current = newKey();
            throw new Error("Payment was cancelled. Your order was not placed.");
          }
          throw e;
        }
      }
      return result.order_id;
    },
    onSuccess: (orderId) => {
      clear();
      void qc.invalidateQueries({ queryKey: queryKeys.orders(userId) });
      void useAuth.getState().refreshProfile();
      router.replace(`/account/orders/${orderId}?placed=1`);
    },
    onError: (e) => {
      setError(describeOrderError(e));
      if (!(e instanceof Error && /cancelled/i.test(e.message))) key.current = newKey();
    },
  });

  if (lines.length === 0) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-xl font-bold">Your cart is empty</h1>
        <Link href="/" className="mt-4 inline-block rounded-xl bg-primary px-4 py-2 font-semibold text-white">Start shopping</Link>
      </div>
    );
  }

  return (
    <div className="grid gap-6 py-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Checkout</h1>
        <Card>
          <h2 className="mb-2 font-semibold">{lines.length} {lines.length === 1 ? "item" : "items"}{store ? ` · delivery in ${store.promised_minutes} min` : ""}</h2>
          <ul className="divide-y divide-divider">
            {lines.map((l) => (
              <li key={l.productId} className="flex items-center gap-3 py-2">
                <ProductImage uri={l.image} alt={l.name} size={48} />
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{l.name}</p><p className="text-xs text-muted">{l.unit_label}</p></div>
                <span className="inline-flex h-8 items-center rounded-lg bg-primary text-white"><button type="button" className="w-7" onClick={() => decrement(l.productId)}>−</button><span className="w-6 text-center text-sm font-bold">{l.quantity}</span><button type="button" className="w-7" onClick={() => increment(l.productId)} disabled={l.quantity >= l.available}>+</button></span>
                <span className="w-20 text-right text-sm font-bold">{formatInr(l.price * l.quantity)}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h2 className="font-semibold">Deliver to</h2>
          {addressId && location ? (
            <p className="mt-1 text-sm"><b className="capitalize">{location.label}</b> · <span className="text-muted">{location.line1}</span></p>
          ) : (
            <p className="mt-1 text-sm text-muted">{status === "unserviceable" ? "This location is not serviceable." : "Save an address with your house or flat number to continue."}</p>
          )}
          <Button variant="secondary" size="sm" className="mt-3" onClick={openLocation}>{addressId ? "Change" : "Add address"}</Button>
        </Card>

        <Card>
          <h2 className="font-semibold">Coupon</h2>
          <div className="mt-2 flex gap-2">
            <div className="flex-1"><TextField name="coupon" placeholder="Enter coupon code" value={couponInput} onChange={(e) => setCouponInput(e.target.value.toUpperCase())} error={bill.coupon_error} /></div>
            <Button variant="secondary" onClick={() => { if (couponCode) { setCoupon(null); setCouponInput(""); } else { const m = coupons.data?.find((c) => c.code.toUpperCase() === couponInput.trim().toUpperCase()); if (!m) setError("That coupon code is not valid."); else { setError(null); setCoupon(m.code); } } }}>{couponCode ? "Remove" : "Apply"}</Button>
          </div>
          {coupons.data?.length ? (
            <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
              {coupons.data.map((c) => (
                <button key={c.id} type="button" onClick={() => { setCouponInput(c.code); setCoupon(c.code); setError(null); }} className={`shrink-0 rounded-full border px-3 py-1 text-xs ${couponCode === c.code ? "border-primary bg-primary text-white" : "border-border bg-surface"}`}><b>{c.code}</b> · {c.title}</button>
              ))}
            </div>
          ) : null}
        </Card>

        <Card>
          <h2 className="font-semibold">Tip your delivery partner</h2>
          <div className="mt-2 flex gap-2">{TIPS.map((t) => <button key={t} type="button" onClick={() => setTip(t)} className={`rounded-full border px-4 py-1.5 text-sm ${tip === t ? "border-primary bg-primary text-white" : "border-border bg-surface"}`}>{t === 0 ? "No tip" : formatInr(t)}</button>)}</div>
        </Card>

        <Card>
          <h2 className="font-semibold">Payment</h2>
          <div className="mt-2 space-y-2">
            {([
              ["online", "Pay online", "UPI, cards, netbanking and wallets via Razorpay", true],
              ["cod", "Cash on delivery", "Pay the delivery partner when your order arrives", true],
              ["ration_wallet", "RATION wallet", `Balance ${formatInr(wallet)}${wallet < bill.total ? " · not enough for this order" : ""}`, wallet >= bill.total],
            ] as [PayChoice, string, string, boolean][]).map(([v, t, s, ok]) => (
              <label key={v} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${pay === v ? "border-primary bg-primary-tint" : "border-border"} ${ok ? "" : "opacity-50"}`}>
                <input type="radio" name="pay" value={v} checked={pay === v} disabled={!ok} onChange={() => setPay(v)} className="accent-primary" />
                <span><span className="block text-sm font-semibold">{t}</span><span className="block text-xs text-muted">{s}</span></span>
              </label>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="font-semibold">Delivery instructions</h2>
          <TextField name="note" placeholder="e.g. Leave at the door, call on arrival" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
        </Card>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <Card>
          <h2 className="mb-3 font-semibold">Bill details</h2>
          <BillRows bill={bill} />
          {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
          <Button variant="accent" size="lg" full className="mt-4" loading={place.isPending} disabled={!addressId || status !== "ready"} onClick={() => { setError(null); place.mutate(); }}>
            {pay === "online" ? "Pay and place order" : "Place order"} · {formatInr(bill.total)}
          </Button>
          {!addressId ? <p className="mt-2 text-center text-xs text-muted">Add a delivery address to continue.</p> : null}
        </Card>
      </aside>
    </div>
  );
}
