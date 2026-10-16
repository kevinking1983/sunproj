"use client";

import { NEXT_STATUS, STATUS_LABEL, type Order } from "@ration/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Badge, Button, Card, Spinner, fmtTime } from "@/components/ui";
import { admin, describeError, qk } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/stores/auth";
import { formatInr, type OrderStatus } from "@ration/shared";

const COLUMNS: { title: string; statuses: OrderStatus[] }[] = [
  { title: "New", statuses: ["placed"] },
  { title: "Preparing", statuses: ["accepted", "packing"] },
  { title: "Ready", statuses: ["ready", "picked_up"] },
  { title: "Out for delivery", statuses: ["out_for_delivery"] },
];

function OrderCard({ order, riders, now }: { order: Order; riders: { id: string; full_name: string | null; phone: string | null }[]; now: number }) {
  const qc = useQueryClient();
  const storeId = useAuth((s) => s.storeId);
  const [error, setError] = useState<string | null>(null);
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: qk.orders(storeId, true) });
    void qc.invalidateQueries({ queryKey: qk.dashboard(storeId) });
  };
  const advance = useMutation({ mutationFn: (s: OrderStatus) => admin.orders.advance(order.id, s), onSuccess: invalidate, onError: (e) => setError(describeError(e)) });
  const assign = useMutation({ mutationFn: (r: string | null) => admin.orders.assignRider(order.id, r), onSuccess: invalidate, onError: (e) => setError(describeError(e)) });
  const cancel = useMutation({ mutationFn: () => admin.orders.cancel(order.id, "Cancelled by store"), onSuccess: invalidate, onError: (e) => setError(describeError(e)) });
  const next = NEXT_STATUS[order.status];
  const late = order.promised_at ? new Date(order.promised_at).getTime() < now : false;
  return (
    <div className={`rounded-xl border bg-surface p-3 text-sm ${late ? "border-danger" : "border-border"}`}>
      <div className="flex items-center justify-between">
        <Link href={`/orders/${order.id}`} className="font-bold text-primary">#{order.order_number}</Link>
        <span className={late ? "font-semibold text-danger" : "text-muted"}>{order.promised_at ? `by ${fmtTime(order.promised_at)}` : fmtTime(order.created_at)}</span>
      </div>
      <p className="mt-1 line-clamp-2 text-muted">{order.order_items.map((i) => `${i.name} ×${i.quantity}`).join(", ")}</p>
      <p className="mt-1 truncate text-xs text-muted">{order.address_snapshot.line1}, {order.address_snapshot.line2}</p>
      <div className="mt-2 flex items-center justify-between"><Badge value={order.status} label={STATUS_LABEL[order.status]} /><span className="font-semibold">{formatInr(order.total)} · {order.payment_method === "cod" ? "COD" : "paid"}</span></div>
      {["ready", "picked_up", "out_for_delivery"].includes(order.status) || order.rider_id ? (
        <select value={order.rider_id ?? ""} onChange={(e) => assign.mutate(e.target.value || null)} className="mt-2 h-8 w-full rounded-lg border border-border bg-surface px-2 text-xs">
          <option value="">Assign rider…</option>
          {riders.map((r) => <option key={r.id} value={r.id}>{r.full_name ?? r.phone}</option>)}
        </select>
      ) : null}
      <div className="mt-2 flex gap-2">
        {next ? <Button size="sm" className="flex-1" loading={advance.isPending} onClick={() => advance.mutate(next)}>→ {STATUS_LABEL[next]}</Button> : null}
        {["placed", "accepted", "packing"].includes(order.status) ? <Button size="sm" variant="ghost" loading={cancel.isPending} onClick={() => confirm(`Cancel order #${order.order_number}?`) && cancel.mutate()}>Cancel</Button> : null}
      </div>
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
    </div>
  );
}

export default function OrdersBoardPage() {
  const qc = useQueryClient();
  const storeId = useAuth((s) => s.storeId);
  const orders = useQuery({ queryKey: qk.orders(storeId, true), queryFn: () => admin.orders.list({ storeId: storeId ?? undefined, active: true }), refetchInterval: 20_000 });
  const riders = useQuery({ queryKey: qk.riders, queryFn: admin.people.riders });
  // "Late" is judged against the last refetch time (every 20 s), which keeps render pure.
  const now = orders.dataUpdatedAt;

  useEffect(() => {
    const ch = supabase
      .channel("admin-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => void qc.invalidateQueries({ queryKey: ["admin-orders"] }))
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [qc]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-bold">Orders board</h1><Link href="/orders/history" className="text-sm font-semibold text-primary">History</Link></div>
      {orders.isLoading ? <Spinner /> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((col) => {
            const items = (orders.data ?? []).filter((o) => col.statuses.includes(o.status));
            return (
              <Card key={col.title} title={`${col.title} (${items.length})`}>
                <div className="space-y-3">{items.map((o) => <OrderCard key={o.id} order={o} riders={riders.data ?? []} now={now} />)}{items.length === 0 ? <p className="text-xs text-muted">Nothing here.</p> : null}</div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
