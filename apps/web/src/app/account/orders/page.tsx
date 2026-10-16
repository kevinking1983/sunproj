"use client";

import { STATUS_LABEL, isActiveStatus } from "@ration/api";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { Empty, Spinner, formatDate } from "@/components/ui";
import { ordersApi, queryKeys } from "@/lib/api";
import { useAuth } from "@/stores/auth";
import { formatInr } from "@ration/shared";

export default function OrdersPage() {
  const router = useRouter();
  const status = useAuth((s) => s.status);
  const userId = useAuth((s) => s.session?.user.id ?? "");
  useEffect(() => {
    if (status === "signed_out") router.replace("/login?next=/account/orders");
  }, [status, router]);
  const orders = useQuery({ queryKey: queryKeys.orders(userId), queryFn: ordersApi.list, enabled: !!userId });
  if (orders.isLoading || status === "loading") return <div className="py-20 text-center"><Spinner /></div>;
  return (
    <div className="py-6">
      <h1 className="text-2xl font-bold">Your orders</h1>
      {orders.data?.length ? (
        <ul className="mt-4 space-y-3">
          {orders.data.map((o) => (
            <li key={o.id}>
              <Link href={`/account/orders/${o.id}`} className="block rounded-card border border-border bg-surface p-4 hover:border-primary">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 font-semibold"><span className={`h-2 w-2 rounded-full ${o.status === "cancelled" ? "bg-danger" : isActiveStatus(o.status) ? "bg-accent" : "bg-success"}`} />{STATUS_LABEL[o.status]}</span>
                  <span className="text-sm text-muted">{formatDate(o.created_at)}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-muted">{o.order_items.map((i) => `${i.name} × ${i.quantity}`).join(", ")}</p>
                <div className="mt-2 flex items-center justify-between text-sm"><span className="text-muted">#{o.order_number}</span><span className="font-bold">{formatInr(o.total)}</span></div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Empty title="No orders yet" body="Your orders and their live status will show up here." action="Start shopping" href="/" />
      )}
    </div>
  );
}
