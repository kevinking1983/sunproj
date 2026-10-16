"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { Badge, Card, Spinner, fmtTime } from "@/components/ui";
import { admin, qk } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/stores/auth";
import { STATUS_LABEL } from "@ration/api";
import { formatInr } from "@ration/shared";

interface Stats {
  active_orders: number;
  orders_today: number;
  revenue_today: number;
  delivered_today: number;
  low_stock: number;
  customers: number;
}

export default function DashboardPage() {
  const storeId = useAuth((s) => s.storeId);
  const stats = useQuery({
    queryKey: qk.dashboard(storeId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("staff_dashboard", { p_store_id: storeId ?? undefined });
      if (error) throw error;
      return data as unknown as Stats;
    },
    refetchInterval: 30_000,
  });
  const active = useQuery({ queryKey: qk.orders(storeId, true), queryFn: () => admin.orders.list({ storeId: storeId ?? undefined, active: true, limit: 8 }), refetchInterval: 15_000 });

  const tiles: [string, string][] = stats.data
    ? [
        ["Active orders", String(stats.data.active_orders)],
        ["Orders today", String(stats.data.orders_today)],
        ["Revenue today", formatInr(stats.data.revenue_today)],
        ["Delivered today", String(stats.data.delivered_today)],
        ["Low stock lines", String(stats.data.low_stock)],
        ["Customers", String(stats.data.customers)],
      ]
    : [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      {stats.isLoading ? <Spinner /> : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {tiles.map(([l, v]) => <div key={l} className="rounded-card border border-border bg-surface p-4"><p className="text-xs uppercase tracking-wide text-muted">{l}</p><p className="mt-1 text-2xl font-bold">{v}</p></div>)}
        </div>
      )}
      <Card title="Live orders" actions={<Link href="/orders" className="text-sm font-semibold text-primary">Open board</Link>}>
        {active.isLoading ? <Spinner /> : active.data?.length ? (
          <ul className="divide-y divide-divider">
            {active.data.map((o) => (
              <li key={o.id} className="flex items-center gap-3 py-2 text-sm">
                <Link href={`/orders/${o.id}`} className="font-semibold text-primary">#{o.order_number}</Link>
                <Badge value={o.status} label={STATUS_LABEL[o.status]} />
                <span className="truncate text-muted">{o.order_items.length} items · {o.address_snapshot.line1}</span>
                <span className="ml-auto">{formatInr(o.total)}</span>
                <span className="text-muted">{fmtTime(o.created_at)}</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted">No active orders right now.</p>}
      </Card>
    </div>
  );
}
