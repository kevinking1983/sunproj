"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";

import { ProductGrid } from "@/components/catalog/ProductCard";
import { StoreGate } from "@/components/catalog/StoreGate";
import { Empty, Spinner } from "@/components/ui";
import { catalogApi, queryKeys } from "@/lib/api";

function CategoryListing({ storeId, slug }: { storeId: string; slug: string }) {
  const [child, setChild] = useState<string | null>(null);
  const categories = useQuery({ queryKey: queryKeys.categories, queryFn: catalogApi.categories });
  const category = categories.data?.find((c) => c.slug === slug);
  const children = useMemo(() => (categories.data ?? []).filter((c) => c.parent_id === category?.id), [categories.data, category?.id]);
  const ids = useMemo(() => (category ? (child ? [child] : [category.id, ...children.map((c) => c.id)]) : []), [category, children, child]);
  const products = useQuery({ queryKey: queryKeys.products(storeId, ids.join(",")), queryFn: () => catalogApi.products(storeId, ids), enabled: ids.length > 0 });

  if (categories.isLoading) return <div className="py-20 text-center"><Spinner /></div>;
  if (!category) return <Empty title="Category not found" action="Back to home" href="/" />;

  return (
    <div className="py-6">
      <h1 className="text-2xl font-bold">{category.name}</h1>
      {children.length ? (
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
          {[{ id: null, name: "All" }, ...children].map((c) => (
            <button key={c.id ?? "all"} type="button" onClick={() => setChild(c.id)} className={`shrink-0 rounded-full border px-4 py-1.5 text-sm ${child === c.id ? "border-primary bg-primary text-white" : "border-border bg-surface"}`}>{c.name}</button>
          ))}
        </div>
      ) : null}
      <div className="mt-5">
        {products.isLoading ? <div className="py-20 text-center"><Spinner /></div> : products.data?.length ? <ProductGrid products={products.data} /> : <Empty title="Nothing stocked here yet" />}
      </div>
    </div>
  );
}

export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  return <StoreGate>{(storeId) => <CategoryListing storeId={storeId} slug={slug} />}</StoreGate>;
}
