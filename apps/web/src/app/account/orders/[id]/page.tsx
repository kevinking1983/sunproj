"use client";

import { STATUS_LABEL, STATUS_STEPS, describeOrderError, isActiveStatus, isCancellableStatus, stepIndex, type Order } from "@ration/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

import dynamic from "next/dynamic";

import { ProductImage } from "@/components/catalog/ProductCard";
import { BillRows } from "@/components/checkout/BillRows";
import { Button, Card, Empty, Spinner, formatTime } from "@/components/ui";
import { ordersApi, queryKeys } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/stores/auth";
import { useCart } from "@/stores/cart";
import { useLocation } from "@/stores/location";

const LiveMap = dynamic(() => import("@/components/tracking/LiveMap").then((m) => m.LiveMap), { ssr: false });
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

function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const placed = useSearchParams().get("placed") === "1";
  const qc = useQueryClient();
  const userId = useAuth((s) => s.session?.user.id ?? "");
  const order = useQuery({ queryKey: queryKeys.order(id), queryFn: () => ordersApi.get(id), enabled: !!id && !!userId });

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
      void useAuth.getState().refreshProfile();
    },
    onError: (e) => alert(describeOrderError(e)),
  });

  const o = order.data;
  if (order.isLoading || !userId) return <div className="py-20 text-center"><Spinner /></div>;
  if (!o) return <Empty title="Order not found" action="Your orders" href="/account/orders" />;

  const reorder = () => {
    const storeId = useLocation.getState().store?.id;
    if (!storeId) return;
    const cart = useCart.getState();
    for (const i of o.order_items) {
      cart.add({ id: i.product_id, slug: "", name: i.name, description: null, unit_label: i.unit_label, mrp: i.mrp, price: i.unit_price, images: i.image_url ? [i.image_url] : [], is_veg: null, category_id: "", brand_name: null, available: 50 }, storeId);
      for (let n = 1; n < i.quantity; n++) cart.increment(i.product_id);
    }
    cart.setOpen(true);
  };

  return (
    <div className="grid gap-6 py-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        {placed ? <div className="rounded-xl bg-success-tint p-3 text-sm"><b className="text-success">Order placed.</b> We have sent it to the store.</div> : null}
        <h1 className="text-2xl font-bold">Order #{o.order_number}</h1>
        <Card>
          <h2 className="text-xl font-bold">{STATUS_LABEL[o.status]}</h2>
          <p className="text-sm text-muted">
            {isActiveStatus(o.status) && o.promised_at ? `Arriving by ${formatTime(o.promised_at)}` : o.delivered_at ? `Delivered at ${formatTime(o.delivered_at)}` : o.cancel_reason ?? ""}
          </p>
          {isActiveStatus(o.status) || o.status === "delivered" ? (
            <ol className="mt-4 grid grid-cols-4 gap-2">
              {STATUS_STEPS.map((s, i) => {
                const done = stepIndex(o.status) >= i;
                return <li key={s} className="flex flex-col items-center gap-1 text-center text-xs"><span className={`grid h-6 w-6 place-items-center rounded-full border-2 ${done ? "border-primary bg-primary text-white" : "border-border bg-surface"}`}>{done ? "✓" : ""}</span><span className={done ? "" : "text-muted"}>{STATUS_LABEL[s]}</span></li>;
              })}
            </ol>
          ) : null}
          {isCancellableStatus(o.status) ? <Button variant="secondary" size="sm" className="mt-4" loading={cancel.isPending} onClick={() => confirm("Cancel this order? Any payment will be refunded.") && cancel.mutate()}>Cancel order</Button> : null}
        </Card>
        {isActiveStatus(o.status) && o.status !== "pending_payment" ? (
          <LiveMap riderId={["picked_up", "out_for_delivery"].includes(o.status) ? o.rider_id : null} destination={{ lat: o.address_snapshot.lat, lng: o.address_snapshot.lng }} />
        ) : null}
        <Card>
          <h2 className="font-semibold">Delivering to</h2>
          <p className="mt-1 text-sm"><b className="capitalize">{o.address_snapshot.label}</b> · <span className="text-muted">{[o.address_snapshot.line1, o.address_snapshot.line2, o.address_snapshot.landmark, o.address_snapshot.city, o.address_snapshot.pincode].filter(Boolean).join(", ")}</span></p>
          {o.customer_note ? <p className="mt-1 text-xs text-muted">Note: {o.customer_note}</p> : null}
        </Card>
        <Card>
          <h2 className="font-semibold">{o.order_items.length} {o.order_items.length === 1 ? "item" : "items"}</h2>
          <ul className="mt-2 divide-y divide-divider">
            {o.order_items.map((i) => (
              <li key={i.id} className="flex items-center gap-3 py-2"><ProductImage uri={i.image_url} alt={i.name} size={44} /><span className="flex-1 text-sm"><span className="block font-medium">{i.name}</span><span className="text-xs text-muted">{i.unit_label} × {i.quantity}</span></span><span className="text-sm font-semibold">{formatInr(i.line_total)}</span></li>
            ))}
          </ul>
        </Card>
      </div>
      <aside className="space-y-3 lg:sticky lg:top-24 lg:self-start">
        <Card><h2 className="mb-3 font-semibold">Bill details</h2><BillRows bill={toBill(o)} /><p className="mt-2 text-xs text-muted">Paid via {o.payment_method === "cod" ? "cash on delivery" : o.payment_method === "ration_wallet" ? "RATION wallet" : "online payment"}</p></Card>
        <Button full onClick={reorder}>Reorder these items</Button>
      </aside>
    </div>
  );
}

export default function OrderPage() {
  return <Suspense><OrderDetail /></Suspense>;
}
