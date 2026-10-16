"use client";

import type { ProductRow } from "@ration/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import { useState } from "react";

import { Button, Card, Checkbox, Field, Select, Spinner, Table, rupees, toPaise } from "@/components/ui";
import { admin, describeError, qk } from "@/lib/api";

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const empty = (categoryId: string): Partial<ProductRow> => ({ name: "", slug: "", category_id: categoryId, unit_label: "", mrp: 0, price: 0, tax_rate: 0, images: [], tags: [], is_veg: null, is_active: true, description: "" });

function ProductForm({ initial, onDone }: { initial: Partial<ProductRow>; onDone: () => void }) {
  const qc = useQueryClient();
  const categories = useQuery({ queryKey: qk.categories, queryFn: admin.categories.list });
  const [f, setF] = useState(initial);
  const [mrp, setMrp] = useState(rupees(initial.mrp));
  const [price, setPrice] = useState(rupees(initial.price));
  const [tags, setTags] = useState((initial.tags ?? []).join(", "));
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const set = <K extends keyof ProductRow>(k: K, v: ProductRow[K]) => setF((x) => ({ ...x, [k]: v }));

  const save = useMutation({
    mutationFn: async () => {
      if (!f.name || !f.category_id || !f.unit_label) throw new Error("Name, category and unit are required");
      const m = toPaise(mrp), p = toPaise(price);
      if (p <= 0 || p > m) throw new Error("Price must be positive and not above MRP");
      return admin.products.upsert({ ...f, name: f.name, slug: f.slug || slugify(f.name), category_id: f.category_id, unit_label: f.unit_label, mrp: m, price: p, tags: tags.split(",").map((t) => t.trim()).filter(Boolean) });
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: qk.products }); onDone(); },
    onError: (e) => setError(describeError(e)),
  });

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const url = await admin.uploadImage("product-images", file, `${f.slug || slugify(f.name || "product")}-${Date.now()}.${file.name.split(".").pop()}`);
      set("images", [url, ...(f.images ?? [])]);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setUploading(false);
    }
  };

  return (
    <form className="grid gap-3 md:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
      <Field label="Name" value={f.name ?? ""} onChange={(e) => { set("name", e.target.value); if (!initial.id) set("slug", slugify(e.target.value)); }} required />
      <Field label="Slug" value={f.slug ?? ""} onChange={(e) => set("slug", e.target.value)} />
      <Select label="Category" value={f.category_id ?? ""} onChange={(e) => set("category_id", e.target.value)}>
        <option value="">Choose…</option>
        {(categories.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.parent_id ? "— " : ""}{c.name}</option>)}
      </Select>
      <Field label="Unit label (e.g. 500 g, 1 L, 6 pcs)" value={f.unit_label ?? ""} onChange={(e) => set("unit_label", e.target.value)} required />
      <Field label="MRP (₹)" value={mrp} onChange={(e) => setMrp(e.target.value)} inputMode="decimal" />
      <Field label="Selling price (₹)" value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" />
      <Field label="GST rate (%)" value={String(f.tax_rate ?? 0)} onChange={(e) => set("tax_rate", Number(e.target.value) || 0)} inputMode="decimal" />
      <Field label="Tags (comma separated)" value={tags} onChange={(e) => setTags(e.target.value)} />
      <label className="block space-y-1 text-sm md:col-span-2"><span className="font-medium">Description</span><textarea value={f.description ?? ""} onChange={(e) => set("description", e.target.value)} rows={3} className="w-full rounded-lg border border-border bg-surface p-2 text-sm" /></label>
      <div className="flex flex-wrap items-center gap-4 md:col-span-2">
        <Select label="Diet" value={f.is_veg === null || f.is_veg === undefined ? "" : f.is_veg ? "veg" : "nonveg"} onChange={(e) => set("is_veg", e.target.value === "" ? null : e.target.value === "veg")}><option value="">Not applicable</option><option value="veg">Vegetarian</option><option value="nonveg">Non-vegetarian</option></Select>
        <Checkbox label="Active (visible to customers)" checked={!!f.is_active} onChange={(e) => set("is_active", e.target.checked)} />
      </div>
      <div className="md:col-span-2">
        <p className="text-sm font-medium">Images</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {(f.images ?? []).map((u) => <span key={u} className="relative"><Image src={u} alt="" width={64} height={64} className="h-16 w-16 rounded-lg object-cover" unoptimized /><button type="button" onClick={() => set("images", (f.images ?? []).filter((x) => x !== u))} className="absolute -right-1 -top-1 rounded-full bg-danger px-1 text-xs text-white">✕</button></span>)}
          <label className="cursor-pointer rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted hover:border-primary">{uploading ? "Uploading…" : "+ Upload"}<input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} /></label>
        </div>
      </div>
      {error ? <p className="text-sm text-danger md:col-span-2">{error}</p> : null}
      <div className="flex gap-2 md:col-span-2"><Button type="submit" loading={save.isPending}>Save product</Button><Button type="button" variant="ghost" onClick={onDone}>Cancel</Button></div>
    </form>
  );
}

export default function ProductsPage() {
  const products = useQuery({ queryKey: qk.products, queryFn: admin.products.list });
  const categories = useQuery({ queryKey: qk.categories, queryFn: admin.categories.list });
  const [editing, setEditing] = useState<Partial<ProductRow> | null>(null);
  const [filter, setFilter] = useState("");
  const catName = (id: string) => categories.data?.find((c) => c.id === id)?.name ?? "";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">Products</h1>
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search" className="ml-auto h-9 rounded-lg border border-border bg-surface px-3 text-sm" />
        <Button onClick={() => setEditing(empty(categories.data?.[0]?.id ?? ""))}>+ New product</Button>
      </div>
      {editing ? <Card title={editing.id ? "Edit product" : "New product"}><ProductForm initial={editing} onDone={() => setEditing(null)} /></Card> : null}
      {products.isLoading ? <Spinner /> : (
        <Table head={["Product", "Category", "MRP", "Price", "Active", ""]}>
          {(products.data ?? []).filter((p) => p.name.toLowerCase().includes(filter.toLowerCase())).map((p) => (
            <tr key={p.id}>
              <td className="px-3 py-2"><span className="flex items-center gap-2">{p.images[0] ? <Image src={p.images[0]} alt="" width={32} height={32} className="h-8 w-8 rounded object-cover" unoptimized /> : <span className="h-8 w-8 rounded bg-primary-tint" />}<span><span className="font-medium">{p.name}</span><span className="block text-xs text-muted">{p.unit_label}</span></span></span></td>
              <td className="px-3 py-2 text-muted">{catName(p.category_id)}</td>
              <td className="px-3 py-2">₹{rupees(p.mrp)}</td>
              <td className="px-3 py-2 font-semibold">₹{rupees(p.price)}</td>
              <td className="px-3 py-2">{p.is_active ? "Yes" : "No"}</td>
              <td className="px-3 py-2 text-right"><Button size="sm" variant="secondary" onClick={() => setEditing(p)}>Edit</Button></td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
