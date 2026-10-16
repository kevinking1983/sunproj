"use client";

import { STATUS_LABEL } from "@ration/api";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { Badge, Spinner, Table, fmtDate } from "@/components/ui";
import { admin, qk } from "@/lib/api";
import { useAuth } from "@/stores/auth";
import { formatInr } from "@ration/shared";

export default function OrderHistoryPage() {
  const storeId = useAuth((s) => s.storeId);
  const orders = useQuery({ queryKey: qk.orders(storeId, false), queryFn: () => admin.orders.list({ storeId: storeId ?? undefined, limit: 200 }) });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Order history</h1>
      {orders.isLoading ? <Spinner /> : (
        <Table head={["Order", "Placed", "Status", "Items", "Payment", "Total"]}>
          {(orders.data ?? []).map((o) => (
            <tr key={o.id}>
              <td className="px-3 py-2"><Link href={`/orders/${o.id}`} className="font-semibold text-primary">#{o.order_number}</Link></td>
              <td className="px-3 py-2 text-muted">{fmtDate(o.created_at)}</td>
              <td className="px-3 py-2"><Badge value={o.status} label={STATUS_LABEL[o.status]} /></td>
              <td className="px-3 py-2">{o.order_items.reduce((n, i) => n + i.quantity, 0)}</td>
              <td className="px-3 py-2 capitalize">{o.payment_method.replace("_", " ")}</td>
              <td className="px-3 py-2 font-semibold">{formatInr(o.total)}</td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
