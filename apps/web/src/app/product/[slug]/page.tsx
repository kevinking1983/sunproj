"use client";

import { buildCategoryTree, categoryPath } from "@ration/api";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";

import { AddButton, ProductImage, discountPercent } from "@/components/catalog/ProductCard";
import { StoreGate } from "@/components/catalog/StoreGate";
import { Empty, Spinner } from "@/components/ui";
import { catalogApi, queryKeys } from "@/lib/api";
import { formatInr } from "@ration/shared";

function ProductDetail({ storeId, slug }: { storeId: string; slug: string }) {
  const product = useQuery({ queryKey: queryKeys.product(storeId, slug), queryFn: () => catalogApi.product(storeId, slug) });
  const categories = useQuery({ queryKey: queryKeys.categories, queryFn: catalogApi.categories });
  const p = product.data;
  const path = useMemo(() => {
    const shelf = categories.data?.find((c) => c.id === p?.category_id);
    return shelf ? categoryPath(buildCategoryTree(categories.data ?? []), shelf.slug) : [];
  }, [categories.data, p?.category_id]);
  if (product.isLoading) return <div className="py-20 text-center"><Spinner /></div>;
  if (!p) return <Empty title="Not available at your store" body="This product is not stocked at the store serving your location." action="Back to home" href="/" />;
  const off = discountPercent(p);
  return (
    <article className="grid gap-8 py-8 md:grid-cols-2">
      {path.length ? (
        <nav aria-label="Breadcrumb" className="text-xs text-muted md:col-span-2">
          <Link href="/" className="hover:text-primary">Home</Link>
          {path.map((n) => (
            <span key={n.id}>{" / "}<Link href={n.depth >= 2 ? `/category/${path[1].slug}?sub=${n.slug}` : `/category/${n.slug}`} className="hover:text-primary">{n.name}</Link></span>
          ))}
        </nav>
      ) : null}
      <figure className="flex flex-col items-center gap-2">
        <ProductImage uri={p.images[0]} alt={p.name} size={360} className="max-w-full" />
        {p.images[0] && p.image_credit ? <figcaption className="max-w-[360px] text-center text-[11px] text-muted">{p.image_credit}</figcaption> : null}
        {!p.images[0] ? <figcaption className="text-xs text-muted">Product photo coming soon</figcaption> : null}
      </figure>
      <div>
        {p.brand_name ? <p className="text-sm text-muted">{p.brand_name}</p> : null}
        <h1 className="text-2xl font-bold">{p.name}</h1>
        <p className="text-muted">{p.unit_label}</p>
        <div className="mt-4 flex items-end gap-3">
          <span className="text-3xl font-bold">{formatInr(p.price)}</span>
          {off > 0 ? <><span className="text-muted line-through">MRP {formatInr(p.mrp)}</span><span className="font-bold text-success">{off}% OFF</span></> : null}
        </div>
        <p className="text-xs text-muted">Inclusive of all taxes</p>
        <div className="mt-5"><AddButton product={p} /></div>
        {p.orderable === false ? <p className="mt-3 text-sm text-muted">We are getting this ready for delivery. It will be available to order soon.</p> : null}
        {p.is_veg !== null ? <p className="mt-4 text-sm text-muted">{p.is_veg ? "🟢 Vegetarian" : "🔴 Non-vegetarian"}</p> : null}
        {p.description ? <section className="mt-6"><h2 className="font-semibold">About this product</h2><p className="mt-1 text-muted">{p.description}</p></section> : null}
        <section className="mt-6 rounded-card bg-primary-tint p-4 text-sm"><h2 className="font-semibold">Why RATION</h2><p className="mt-1 text-muted">Fresh stock from your nearest store, delivered in minutes. Easy refunds on damaged or incorrect items.</p></section>
      </div>
    </article>
  );
}

export default function ProductPage() {
  const { slug } = useParams<{ slug: string }>();
  return <StoreGate>{(storeId) => <ProductDetail storeId={storeId} slug={slug} />}</StoreGate>;
}
