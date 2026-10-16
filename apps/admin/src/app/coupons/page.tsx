"use client";

import type { CouponRow } from "@ration/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button, Card, Checkbox, Field, Select, Spinner, Table, rupees, toPaise } from "@/components/ui";
import { admin, describeError, qk } from "@/lib/api";

function CouponForm({ initial, onDone }: { initial: Partial<CouponRow>; onDone: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState(initial);
  const [value, setValue] = useState(initial.discount_type === "percent" ? String(initial.discount_value ?? 0) : rupees(initial.discount_value));
  const [max, setMax] = useState(initial.max_discount === null || initial.max_discount === undefined ? "" : rupees(initial.max_discount));
  const [min, setMin] = useState(rupees(initial.min_order_amount));
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => admin.coupons.upsert({
      ...f,
      code: (f.code ?? "").toUpperCase().trim(),
      title: f.title ?? "",
      discount_type: f.discount_type ?? "flat",
      discount_value: f.discount_type === "percent" ? Number(value) || 0 : toPaise(value),
      max_discount: max.trim() === "" ? null : toPaise(max),
      min_order_amount: toPaise(min),
      per_user_limit: f.per_user_limit ?? 1,
      total_limit: f.total_limit ?? null,
      first_order_only: f.first_order_only ?? false,
      is_active: f.is_active ?? true,
    }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: qk.coupons }); onDone(); },
    onError: (e) => setError(describeError(e)),
  });
  return (
    <form className="grid gap-3 md:grid-cols-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
      <Field label="Code" value={f.code ?? ""} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} required />
      <Field label="Title" value={f.title ?? ""} onChange={(e) => setF({ ...f, title: e.target.value })} required />
      <Select label="Type" value={f.discount_type ?? "flat"} onChange={(e) => setF({ ...f, discount_type: e.target.value as CouponRow["discount_type"] })}><option value="flat">Flat amount</option><option value="percent">Percentage</option><option value="free_delivery">Free delivery</option></Select>
      <Field label={f.discount_type === "percent" ? "Discount (%)" : "Discount (₹)"} value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" disabled={f.discount_type === "free_delivery"} />
      <Field label="Max discount (₹, optional)" value={max} onChange={(e) => setMax(e.target.value)} inputMode="decimal" />
      <Field label="Minimum order (₹)" value={min} onChange={(e) => setMin(e.target.value)} inputMode="decimal" />
      <Field label="Uses per customer" value={String(f.per_user_limit ?? 1)} onChange={(e) => setF({ ...f, per_user_limit: Number(e.target.value) || 1 })} inputMode="numeric" />
      <Field label="Total uses (blank = unlimited)" value={f.total_limit === null || f.total_limit === undefined ? "" : String(f.total_limit)} onChange={(e) => setF({ ...f, total_limit: e.target.value === "" ? null : Number(e.target.value) })} inputMode="numeric" />
      <Field label="Description" value={f.description ?? ""} onChange={(e) => setF({ ...f, description: e.target.value })} />
      <div className="flex items-center gap-4 md:col-span-3"><Checkbox label="First order only" checked={f.first_order_only ?? false} onChange={(e) => setF({ ...f, first_order_only: e.target.checked })} /><Checkbox label="Active" checked={f.is_active ?? true} onChange={(e) => setF({ ...f, is_active: e.target.checked })} /></div>
      {error ? <p className="text-sm text-danger md:col-span-3">{error}</p> : null}
      <div className="flex gap-2 md:col-span-3"><Button type="submit" loading={save.isPending}>Save coupon</Button><Button type="button" variant="ghost" onClick={onDone}>Cancel</Button></div>
    </form>
  );
}

export default function CouponsPage() {
  const coupons = useQuery({ queryKey: qk.coupons, queryFn: admin.coupons.list });
  const [editing, setEditing] = useState<Partial<CouponRow> | null>(null);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-bold">Coupons</h1><Button onClick={() => setEditing({ code: "", title: "", discount_type: "flat", discount_value: 0, min_order_amount: 0, per_user_limit: 1, is_active: true })}>+ New coupon</Button></div>
      {editing ? <Card title={editing.id ? "Edit coupon" : "New coupon"}><CouponForm initial={editing} onDone={() => setEditing(null)} /></Card> : null}
      {coupons.isLoading ? <Spinner /> : (
        <Table head={["Code", "Title", "Discount", "Min order", "Used", "Active", ""]}>
          {(coupons.data ?? []).map((c) => (
            <tr key={c.id}><td className="px-3 py-2 font-mono font-semibold">{c.code}</td><td className="px-3 py-2">{c.title}</td><td className="px-3 py-2">{c.discount_type === "percent" ? `${c.discount_value}%` : c.discount_type === "free_delivery" ? "Free delivery" : `₹${rupees(c.discount_value)}`}{c.max_discount ? ` (max ₹${rupees(c.max_discount)})` : ""}</td><td className="px-3 py-2">₹{rupees(c.min_order_amount)}</td><td className="px-3 py-2">{c.used_count}{c.total_limit ? ` / ${c.total_limit}` : ""}</td><td className="px-3 py-2">{c.is_active ? "Yes" : "No"}</td><td className="px-3 py-2 text-right"><Button size="sm" variant="secondary" onClick={() => setEditing(c)}>Edit</Button></td></tr>
          ))}
        </Table>
      )}
    </div>
  );
}
