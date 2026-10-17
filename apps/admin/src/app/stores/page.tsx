"use client";

import type { StoreRow } from "@ration/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button, Card, Checkbox, Field, Spinner, Table, rupees, toPaise } from "@/components/ui";
import { admin, describeError, qk } from "@/lib/api";

function StoreForm({ initial, onDone }: { initial: Partial<StoreRow>; onDone: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState(initial);
  const [fees, setFees] = useState({ min: rupees(initial.min_order_amount ?? 9900), delivery: rupees(initial.delivery_fee ?? 2500), free: rupees(initial.free_delivery_above ?? 19900) });
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => admin.stores.upsert({ ...f, name: f.name ?? "", code: f.code ?? "", address: f.address ?? "", lat: Number(f.lat), lng: Number(f.lng), min_order_amount: toPaise(fees.min), delivery_fee: toPaise(fees.delivery), free_delivery_above: toPaise(fees.free) }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: qk.stores }); onDone(); },
    onError: (e) => setError(describeError(e)),
  });
  const num = (k: keyof StoreRow) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: Number(e.target.value) });
  return (
    <form className="grid gap-3 md:grid-cols-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
      <Field label="Name" value={f.name ?? ""} onChange={(e) => setF({ ...f, name: e.target.value })} required />
      <Field label="Code" value={f.code ?? ""} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} required />
      <Field label="Address" value={f.address ?? ""} onChange={(e) => setF({ ...f, address: e.target.value })} required />
      <Field label="Latitude" value={String(f.lat ?? "")} onChange={num("lat")} inputMode="decimal" required />
      <Field label="Longitude" value={String(f.lng ?? "")} onChange={num("lng")} inputMode="decimal" required />
      <Field label="Service radius (m)" value={String(f.service_radius_m ?? 3000)} onChange={num("service_radius_m")} inputMode="numeric" />
      <Field label="Opens at" type="time" value={(f.opens_at ?? "06:00").slice(0, 5)} onChange={(e) => setF({ ...f, opens_at: e.target.value })} />
      <Field label="Closes at" type="time" value={(f.closes_at ?? "23:59").slice(0, 5)} onChange={(e) => setF({ ...f, closes_at: e.target.value })} />
      <Field label="Promised minutes" value={String(f.promised_minutes ?? 15)} onChange={num("promised_minutes")} inputMode="numeric" />
      <Field label="Minimum order (₹)" value={fees.min} onChange={(e) => setFees({ ...fees, min: e.target.value })} inputMode="decimal" />
      <Field label="Delivery fee (₹)" value={fees.delivery} onChange={(e) => setFees({ ...fees, delivery: e.target.value })} inputMode="decimal" />
      <Field label="Free delivery above (₹)" value={fees.free} onChange={(e) => setFees({ ...fees, free: e.target.value })} inputMode="decimal" />
      <Field label="Rider assignment radius (m)" value={String(f.assign_radius_m ?? 5000)} onChange={num("assign_radius_m")} inputMode="numeric" />
      <div className="flex flex-col gap-2 md:col-span-3">
        <Checkbox label="Open for orders" checked={f.is_open ?? true} onChange={(e) => setF({ ...f, is_open: e.target.checked })} />
        <Checkbox label="Assign riders automatically when packing starts (nearest free online rider)" checked={f.auto_assign_riders ?? true} onChange={(e) => setF({ ...f, auto_assign_riders: e.target.checked })} />
      </div>
      {error ? <p className="text-sm text-danger md:col-span-3">{error}</p> : null}
      <div className="flex gap-2 md:col-span-3"><Button type="submit" loading={save.isPending}>Save store</Button><Button type="button" variant="ghost" onClick={onDone}>Cancel</Button></div>
    </form>
  );
}

export default function StoresPage() {
  const stores = useQuery({ queryKey: qk.stores, queryFn: admin.stores.list });
  const [editing, setEditing] = useState<Partial<StoreRow> | null>(null);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-bold">Stores</h1><Button onClick={() => setEditing({ is_open: true, service_radius_m: 3000, auto_assign_riders: true, assign_radius_m: 5000, promised_minutes: 15, opens_at: "06:00", closes_at: "23:59" })}>+ New store</Button></div>
      {editing ? <Card title={editing.id ? "Edit store" : "New dark store"}><StoreForm initial={editing} onDone={() => setEditing(null)} /></Card> : null}
      {stores.isLoading ? <Spinner /> : (
        <Table head={["Store", "Address", "Radius", "Hours", "ETA", "Open", ""]}>
          {(stores.data ?? []).map((s) => (
            <tr key={s.id}><td className="px-3 py-2"><span className="font-medium">{s.name}</span><span className="block text-xs text-muted">{s.code}</span></td><td className="px-3 py-2 text-muted">{s.address}</td><td className="px-3 py-2">{(s.service_radius_m / 1000).toFixed(1)} km</td><td className="px-3 py-2">{s.opens_at.slice(0, 5)}–{s.closes_at.slice(0, 5)}</td><td className="px-3 py-2">{s.promised_minutes} min</td><td className="px-3 py-2">{s.is_open ? "Yes" : "No"}</td><td className="px-3 py-2 text-right"><Button size="sm" variant="secondary" onClick={() => setEditing(s)}>Edit</Button></td></tr>
          ))}
        </Table>
      )}
    </div>
  );
}
