"use client";

import type { CategoryRow } from "@ration/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button, Card, Checkbox, Field, Select, Spinner, Table } from "@/components/ui";
import { admin, describeError, qk } from "@/lib/api";

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

function CategoryForm({ initial, parents, onDone }: { initial: Partial<CategoryRow>; parents: CategoryRow[]; onDone: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const save = useMutation({
    mutationFn: () => admin.categories.upsert({ ...f, name: f.name ?? "", slug: f.slug || slugify(f.name ?? ""), parent_id: f.parent_id || null, sort_order: f.sort_order ?? 0, is_active: f.is_active ?? true }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: qk.categories }); onDone(); },
    onError: (e) => setError(describeError(e)),
  });
  return (
    <form className="grid gap-3 md:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
      <Field label="Name" value={f.name ?? ""} onChange={(e) => setF({ ...f, name: e.target.value, slug: initial.id ? f.slug : slugify(e.target.value) })} required />
      <Field label="Slug" value={f.slug ?? ""} onChange={(e) => setF({ ...f, slug: e.target.value })} />
      <Select label="Parent" value={f.parent_id ?? ""} onChange={(e) => setF({ ...f, parent_id: e.target.value || null })}><option value="">Top level</option>{parents.filter((p) => p.id !== f.id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
      <Field label="Sort order" value={String(f.sort_order ?? 0)} onChange={(e) => setF({ ...f, sort_order: Number(e.target.value) || 0 })} inputMode="numeric" />
      <div className="flex items-center gap-4 md:col-span-2">
        <Checkbox label="Active" checked={f.is_active ?? true} onChange={(e) => setF({ ...f, is_active: e.target.checked })} />
        <label className="cursor-pointer text-sm text-primary">{uploading ? "Uploading…" : f.image_url ? "Replace image" : "Upload image"}<input type="file" accept="image/*" className="hidden" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; setUploading(true); try { setF({ ...f, image_url: await admin.uploadImage("product-images", file, `category-${f.slug || "new"}-${Date.now()}.${file.name.split(".").pop()}`) }); } catch (err) { setError(describeError(err)); } finally { setUploading(false); } }} /></label>
      </div>
      {error ? <p className="text-sm text-danger md:col-span-2">{error}</p> : null}
      <div className="flex gap-2 md:col-span-2"><Button type="submit" loading={save.isPending}>Save</Button><Button type="button" variant="ghost" onClick={onDone}>Cancel</Button></div>
    </form>
  );
}

export default function CategoriesPage() {
  const categories = useQuery({ queryKey: qk.categories, queryFn: admin.categories.list });
  const [editing, setEditing] = useState<Partial<CategoryRow> | null>(null);
  const parents = (categories.data ?? []).filter((c) => !c.parent_id);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-bold">Categories</h1><Button onClick={() => setEditing({ name: "", slug: "", parent_id: null, sort_order: (categories.data?.length ?? 0) + 1, is_active: true })}>+ New category</Button></div>
      {editing ? <Card title={editing.id ? "Edit category" : "New category"}><CategoryForm initial={editing} parents={parents} onDone={() => setEditing(null)} /></Card> : null}
      {categories.isLoading ? <Spinner /> : (
        <Table head={["Category", "Slug", "Order", "Active", ""]}>
          {parents.flatMap((p) => [p, ...(categories.data ?? []).filter((c) => c.parent_id === p.id)]).map((c) => (
            <tr key={c.id}><td className="px-3 py-2">{c.parent_id ? <span className="pl-4 text-muted">— {c.name}</span> : <span className="font-medium">{c.name}</span>}</td><td className="px-3 py-2 text-muted">{c.slug}</td><td className="px-3 py-2">{c.sort_order}</td><td className="px-3 py-2">{c.is_active ? "Yes" : "No"}</td><td className="px-3 py-2 text-right"><Button size="sm" variant="secondary" onClick={() => setEditing(c)}>Edit</Button></td></tr>
          ))}
        </Table>
      )}
    </div>
  );
}
