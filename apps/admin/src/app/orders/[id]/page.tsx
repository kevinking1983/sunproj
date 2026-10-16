"use client";

import { NEXT_STATUS, STATUS_LABEL } from "@ration/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useState } from "react";

import { Badge, Button, Card, Spinner, fmtDate } from "@/components/ui";
import { admin, describeError, qk } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { formatInr, type OrderStatus } from "@ration/shared";

export default function AdminOrderPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const order = useQuery({
    queryKey: qk.order(id),
    queryFn: async () => {
      const { data, error: e } = await supabase.from("orders").select("*, order_items(*), order_events(*), profiles!orders_user_id_fkey(full_name, phone)").eq("id", id).maybeSingle();
      if (e) throw e;
      return data;
    },
  });
  const riders = useQuery({ queryKey: qk.riders, queryFn: admin.people.riders });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: qk.order(id) });
    void qc.invalidateQueries({ queryKey: ["admin-orders"] });
  };
  const advance = useMutation({ mutationFn: (s: OrderStatus) => admin.orders.advance(id, s), onSuccess: refresh, onError: (e) => setError(describeError(e)) });
  const assign = useMutation({ mutationFn: (r: string | null) => admin.orders.assignRider(id, r), onSuccess: refresh, onError: (e) => setError(describeError(e)) });
  const cancel = useMutation({ mutationFn: () => admin.orders.cancel(id, "Cancelled by store"), onSuccess: refresh, onError: (e) => setError(describeError(e)) });

  const o = order.data;
  if (order.isLoading) return <Spinner />;
  if (!o) return <p className="text-muted">Order not found.</p>;
  const next = NEXT_STATUS[o.status as OrderStatus];
  const addr = o.address_snapshot as { line1: string; line2: string | null; landmark: string | null; city: string; pincode: string; recipient_name?: string | null; recipient_phone?: string | null };
  const customer = o.profiles as { full_name: string | null; phone: string | null } | null;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl font-bold">Order #{o.order_number}</h1><Badge value={o.status} label={STATUS_LABEL[o.status as OrderStatus]} /><span className="text-sm text-muted">{fmtDate(o.created_at)}</span></div>
        <Card title="Items">
          <ul className="divide-y divide-divider text-sm">
            {(o.order_items as { id: string; name: string; unit_label: string; quantity: number; line_total: number }[]).map((i) => (
              <li key={i.id} className="flex justify-between py-2"><span>{i.name} <span className="text-muted">· {i.unit_label} × {i.quantity}</span></span><span>{formatInr(i.line_total)}</span></li>
            ))}
          </ul>
          <div className="mt-2 space-y-1 border-t border-divider pt-2 text-sm">
            <p className="flex justify-between text-muted"><span>Subtotal</span><span>{formatInr(o.subtotal)}</span></p>
            {o.discount > 0 ? <p className="flex justify-between text-muted"><span>Discount {o.coupon_code ?? ""}</span><span>-{formatInr(o.discount)}</span></p> : null}
            <p className="flex justify-between text-muted"><span>Delivery + handling</span><span>{formatInr(o.delivery_fee + o.handling_fee)}</span></p>
            {o.tip > 0 ? <p className="flex justify-between text-muted"><span>Tip</span><span>{formatInr(o.tip)}</span></p> : null}
            <p className="flex justify-between font-bold"><span>Total ({o.payment_method})</span><span>{formatInr(o.total)}</span></p>
          </div>
        </Card>
        <Card title="Timeline">
          <ol className="space-y-1 text-sm">
            {(o.order_events as { id: number; status: string; note: string | null; created_at: string }[]).sort((a, b) => a.id - b.id).map((e) => (
              <li key={e.id} className="flex gap-3"><span className="w-32 shrink-0 text-muted">{fmtDate(e.created_at)}</span><span><b>{STATUS_LABEL[e.status as OrderStatus]}</b>{e.note ? ` · ${e.note}` : ""}</span></li>
            ))}
          </ol>
        </Card>
      </div>
      <div className="space-y-4">
        <Card title="Customer">
          <p className="text-sm font-semibold">{addr.recipient_name || customer?.full_name || "Customer"}</p>
          <p className="text-sm text-muted">{addr.recipient_phone || customer?.phone}</p>
          <p className="mt-2 text-sm">{[addr.line1, addr.line2, addr.landmark, addr.city, addr.pincode].filter(Boolean).join(", ")}</p>
          {o.customer_note ? <p className="mt-2 rounded bg-accent-tint p-2 text-xs">Note: {o.customer_note}</p> : null}
        </Card>
        <Card title="Actions">
          <div className="space-y-2">
            <select value={o.rider_id ?? ""} onChange={(e) => assign.mutate(e.target.value || null)} className="h-10 w-full rounded-lg border border-border bg-surface px-2 text-sm">
              <option value="">No rider assigned</option>
              {(riders.data ?? []).map((r) => <option key={r.id} value={r.id}>{r.full_name ?? r.phone}</option>)}
            </select>
            {next ? <Button className="w-full" loading={advance.isPending} onClick={() => advance.mutate(next)}>Mark {STATUS_LABEL[next]}</Button> : null}
            {!["delivered", "cancelled", "refunded"].includes(o.status) ? <Button className="w-full" variant="danger" loading={cancel.isPending} onClick={() => confirm("Cancel this order and refund the customer?") && cancel.mutate()}>Cancel order</Button> : null}
            {error ? <p className="text-xs text-danger">{error}</p> : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
