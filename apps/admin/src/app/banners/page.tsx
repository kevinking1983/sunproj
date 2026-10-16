"use client";

import type { BannerRow } from "@ration/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import { useState } from "react";

import { Button, Card, Checkbox, Field, Select, Spinner } from "@/components/ui";
import { admin, describeError, qk } from "@/lib/api";

export default function BannersPage() {
  const qc = useQueryClient();
  const banners = useQuery({ queryKey: qk.banners, queryFn: admin.banners.list });
  const categories = useQuery({ queryKey: qk.categories, queryFn: admin.categories.list });
  const [f, setF] = useState<Partial<BannerRow> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const refresh = () => void qc.invalidateQueries({ queryKey: qk.banners });
  const save = useMutation({ mutationFn: () => admin.banners.upsert({ ...f, image_url: f?.image_url ?? "", sort_order: f?.sort_order ?? 0, is_active: f?.is_active ?? true }), onSuccess: () => { refresh(); setF(null); }, onError: (e) => setError(describeError(e)) });
  const remove = useMutation({ mutationFn: (id: string) => admin.banners.remove(id), onSuccess: refresh });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-bold">Banners</h1><Button onClick={() => setF({ title: "", image_url: "", target_type: "category", target_id: "", sort_order: (banners.data?.length ?? 0) + 1, is_active: true })}>+ New banner</Button></div>
      {f ? (
        <Card title={f.id ? "Edit banner" : "New banner"}>
          <form className="grid gap-3 md:grid-cols-2" onSubmit={(e) => { e.preventDefault(); if (!f.image_url) return setError("Upload an image first"); save.mutate(); }}>
            <Field label="Title (accessibility)" value={f.title ?? ""} onChange={(e) => setF({ ...f, title: e.target.value })} />
            <Field label="Sort order" value={String(f.sort_order ?? 0)} onChange={(e) => setF({ ...f, sort_order: Number(e.target.value) || 0 })} inputMode="numeric" />
            <Select label="Links to" value={f.target_type ?? ""} onChange={(e) => setF({ ...f, target_type: e.target.value || null, target_id: "" })}><option value="">Nothing</option><option value="category">Category</option><option value="product">Product (slug)</option></Select>
            {f.target_type === "category" ? <Select label="Category" value={f.target_id ?? ""} onChange={(e) => setF({ ...f, target_id: e.target.value })}><option value="">Choose…</option>{(categories.data ?? []).map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}</Select> : f.target_type === "product" ? <Field label="Product slug" value={f.target_id ?? ""} onChange={(e) => setF({ ...f, target_id: e.target.value })} /> : <span />}
            <div className="flex items-center gap-4 md:col-span-2">
              <Checkbox label="Active" checked={f.is_active ?? true} onChange={(e) => setF({ ...f, is_active: e.target.checked })} />
              <label className="cursor-pointer text-sm text-primary">{uploading ? "Uploading…" : f.image_url ? "Replace image" : "Upload image (2.4:1)"}<input type="file" accept="image/*" className="hidden" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; setUploading(true); try { setF({ ...f, image_url: await admin.uploadImage("banners", file, `banner-${Date.now()}.${file.name.split(".").pop()}`) }); } catch (err) { setError(describeError(err)); } finally { setUploading(false); } }} /></label>
              {f.image_url ? <Image src={f.image_url} alt="" width={160} height={66} className="h-16 w-40 rounded object-cover" unoptimized /> : null}
            </div>
            {error ? <p className="text-sm text-danger md:col-span-2">{error}</p> : null}
            <div className="flex gap-2 md:col-span-2"><Button type="submit" loading={save.isPending}>Save</Button><Button type="button" variant="ghost" onClick={() => setF(null)}>Cancel</Button></div>
          </form>
        </Card>
      ) : null}
      {banners.isLoading ? <Spinner /> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(banners.data ?? []).map((b) => (
            <div key={b.id} className="rounded-card border border-border bg-surface p-3">
              <Image src={b.image_url} alt={b.title ?? ""} width={400} height={166} className="aspect-[2.4] w-full rounded-lg object-cover" unoptimized />
              <div className="mt-2 flex items-center justify-between text-sm"><span>{b.title || "Untitled"} · #{b.sort_order} {b.is_active ? "" : "(hidden)"}</span><span className="flex gap-1"><Button size="sm" variant="secondary" onClick={() => setF(b)}>Edit</Button><Button size="sm" variant="ghost" onClick={() => confirm("Delete banner?") && remove.mutate(b.id)}>Delete</Button></span></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
