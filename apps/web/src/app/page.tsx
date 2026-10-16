"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";

import { ProductCard } from "@/components/catalog/ProductCard";
import { StoreGate } from "@/components/catalog/StoreGate";
import { Spinner } from "@/components/ui";
import { catalogApi, queryKeys } from "@/lib/api";

const RAIL_SIZE = 10;

function Storefront({ storeId }: { storeId: string }) {
  const categories = useQuery({ queryKey: queryKeys.categories, queryFn: catalogApi.categories });
  const banners = useQuery({ queryKey: queryKeys.banners, queryFn: catalogApi.banners });
  const products = useQuery({ queryKey: queryKeys.products(storeId), queryFn: () => catalogApi.products(storeId) });

  const top = useMemo(() => (categories.data ?? []).filter((c) => !c.parent_id), [categories.data]);
  const list = products.data;
  const rails = useMemo(() => {
    const by = new Map<string, NonNullable<typeof list>>();
    for (const p of list ?? []) {
      const arr = by.get(p.category_id) ?? [];
      if (arr.length < RAIL_SIZE) arr.push(p);
      by.set(p.category_id, arr);
    }
    return top.map((c) => ({ category: c, items: by.get(c.id) ?? [] })).filter((r) => r.items.length > 0);
  }, [list, top]);

  if (products.isLoading || categories.isLoading) return <div className="py-20 text-center"><Spinner /></div>;

  return (
    <div className="space-y-10 py-6">
      {banners.data?.length ? (
        <div className="no-scrollbar flex snap-x gap-3 overflow-x-auto">
          {banners.data.map((b) => (
            <Link key={b.id} href={b.target_type === "category" && b.target_id ? `/category/${b.target_id}` : b.target_type === "product" && b.target_id ? `/product/${b.target_id}` : "/"} className="relative aspect-[2.6] w-[85%] shrink-0 snap-start overflow-hidden rounded-card bg-primary-tint sm:w-[60%] lg:w-[40%]">
              <Image src={b.image_url} alt={b.title ?? "Offer"} fill className="object-cover" unoptimized />
            </Link>
          ))}
        </div>
      ) : (
        <section className="rounded-card bg-primary-dark p-6 text-ivory sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">Delivery in minutes</p>
          <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">Fresh groceries, right to your door.</h1>
          <p className="mt-2 max-w-xl text-ivory/80">Fruits, vegetables, dairy, snacks and daily essentials from your nearest RATION store.</p>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-bold">Shop by category</h2>
          <Link href="/categories" className="text-sm font-semibold text-primary">See all</Link>
        </div>
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8">
          {top.map((c) => (
            <Link key={c.id} href={`/category/${c.slug}`} className="flex flex-col items-center gap-2 text-center">
              <span className="relative aspect-square w-full overflow-hidden rounded-card bg-primary-tint">
                {c.image_url ? <Image src={c.image_url} alt="" fill className="object-cover" unoptimized /> : null}
              </span>
              <span className="line-clamp-2 text-xs font-medium">{c.name}</span>
            </Link>
          ))}
        </div>
      </section>

      {rails.map((r) => (
        <section key={r.category.id}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-bold">{r.category.name}</h2>
            <Link href={`/category/${r.category.slug}`} className="text-sm font-semibold text-primary">See all</Link>
          </div>
          <div className="no-scrollbar flex gap-3 overflow-x-auto">
            {r.items.map((p) => (
              <div key={p.id} className="w-[160px] shrink-0">
                <ProductCard product={p} />
              </div>
            ))}
          </div>
        </section>
      ))}
      {rails.length === 0 ? <p className="py-10 text-center text-muted">No products stocked at this store yet.</p> : null}
    </div>
  );
}

export default function HomePage() {
  return <StoreGate>{(storeId) => <Storefront storeId={storeId} />}</StoreGate>;
}
