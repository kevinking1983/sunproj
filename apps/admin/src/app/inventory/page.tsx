"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { Button, Spinner, Table, rupees, toPaise } from "@/components/ui";
import { admin, describeError, qk } from "@/lib/api";
import { useAuth } from "@/stores/auth";

function StockRow({ storeId, productId, name, unit, basePrice, quantity, reserved, override, onSaved }: { storeId: string; productId: string; name: string; unit: string; basePrice: number; quantity: number; reserved: number; override: number | null; onSaved: () => void }) {
  const [qty, setQty] = useState(String(quantity));
  const [price, setPrice] = useState(override === null ? "" : rupees(override));
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({ mutationFn: () => admin.inventory.set(storeId, productId, Number(qty), price.trim() === "" ? null : toPaise(price)), onSuccess: onSaved, onError: (e) => setError(describeError(e)) });
  const dirty = qty !== String(quantity) || (price.trim() === "" ? override !== null : toPaise(price) !== override);
  const available = quantity - reserved;
  return (
    <tr className={available <= 5 ? "bg-danger-tint/40" : ""}>
      <td className="px-3 py-2"><span className="font-medium">{name}</span><span className="block text-xs text-muted">{unit} · base ₹{rupees(basePrice)}</span></td>
      <td className="px-3 py-2"><input value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} className="h-8 w-20 rounded border border-border px-2 text-sm" inputMode="numeric" /></td>
      <td className="px-3 py-2 text-muted">{reserved}</td>
      <td className={`px-3 py-2 font-semibold ${available <= 5 ? "text-danger" : ""}`}>{available}</td>
      <td className="px-3 py-2"><input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="base" className="h-8 w-24 rounded border border-border px-2 text-sm" inputMode="decimal" /></td>
      <td className="px-3 py-2"><Button size="sm" disabled={!dirty} loading={save.isPending} onClick={() => save.mutate()}>Save</Button>{error ? <span className="ml-2 text-xs text-danger">{error}</span> : null}</td>
    </tr>
  );
}

export default function InventoryPage() {
  const qc = useQueryClient();
  const globalStore = useAuth((s) => s.storeId);
  const stores = useQuery({ queryKey: qk.stores, queryFn: admin.stores.list });
  const storeId = globalStore ?? stores.data?.[0]?.id ?? "";
  const products = useQuery({ queryKey: qk.products, queryFn: admin.products.list });
  const inventory = useQuery({ queryKey: qk.inventory(storeId), queryFn: () => admin.inventory.forStore(storeId), enabled: !!storeId });
  const [filter, setFilter] = useState("");
  const [onlyLow, setOnlyLow] = useState(false);

  const rows = useMemo(() => {
    const inv = new Map((inventory.data ?? []).map((i) => [i.product_id, i]));
    return (products.data ?? [])
      .filter((p) => p.is_active && p.name.toLowerCase().includes(filter.toLowerCase()))
      .map((p) => ({ p, i: inv.get(p.id) }))
      .filter(({ i }) => !onlyLow || !i || i.quantity - i.reserved <= 5);
  }, [products.data, inventory.data, filter, onlyLow]);

  if (stores.isLoading || products.isLoading) return <Spinner />;
  if (!storeId) return <p className="text-muted">Create a store first.</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">Inventory</h1>
        <span className="text-sm text-muted">{stores.data?.find((s) => s.id === storeId)?.name}</span>
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter products" className="ml-auto h-9 rounded-lg border border-border bg-surface px-3 text-sm" />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} className="accent-primary" />Low stock only</label>
      </div>
      <Table head={["Product", "Stock", "Reserved", "Available", "Store price (₹)", ""]}>
        {rows.map(({ p, i }) => (
          <StockRow key={p.id} storeId={storeId} productId={p.id} name={p.name} unit={p.unit_label} basePrice={p.price} quantity={i?.quantity ?? 0} reserved={i?.reserved ?? 0} override={i?.price_override ?? null} onSaved={() => void qc.invalidateQueries({ queryKey: qk.inventory(storeId) })} />
        ))}
      </Table>
    </div>
  );
}
