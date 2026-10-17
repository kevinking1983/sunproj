"use client";

import { buildCategoryTree, categoryIcon, findCategory, type CategoryNode } from "@ration/api";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";

import { CategoryTile } from "@/components/catalog/CategoryTile";
import { ProductCard } from "@/components/catalog/ProductCard";
import { StoreGate } from "@/components/catalog/StoreGate";
import { Spinner } from "@/components/ui";
import { catalogApi, queryKeys } from "@/lib/api";

const RAIL_SIZE = 12;
/** Everyday shelves featured on the home page, in this order. Missing or empty shelves are skipped. */
const FEATURED_SHELVES = [
  "dairy-bread-eggs-milk",
  "atta-rice-dal-dal",
  "dairy-bread-eggs-bread-pav",
  "vegetables-fruits-fresh-vegetables",
  "vegetables-fruits-fresh-fruits",
  "chips-namkeen-chips-wafers",
  "drinks-juices-soft-drinks",
  "sweets-chocolates-chocolates",
  "bath-body-bathing-soaps",
  "cleaners-repellents-liquid-detergents",
];

function ShelfRail({ storeId, shelf, parent }: { storeId: string; shelf: CategoryNode; parent?: CategoryNode }) {
  const products = useQuery({ queryKey: queryKeys.products(storeId, `shelf:${shelf.id}`), queryFn: () => catalogApi.products(storeId, [shelf.id], RAIL_SIZE) });
  if (!products.data?.length) return null;
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-bold">{shelf.name}</h2>
        <Link href={parent ? `/category/${parent.slug}?sub=${shelf.slug}` : `/category/${shelf.slug}`} className="text-sm font-semibold text-primary">See all</Link>
      </div>
      <div className="no-scrollbar flex gap-3 overflow-x-auto">
        {products.data.map((p) => (
          <div key={p.id} className="w-[160px] shrink-0">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </section>
  );
}

function Storefront({ storeId }: { storeId: string }) {
  const categories = useQuery({ queryKey: queryKeys.categories, queryFn: catalogApi.categories });
  const banners = useQuery({ queryKey: queryKeys.banners, queryFn: catalogApi.banners });
  const tree = useMemo(() => buildCategoryTree(categories.data ?? []), [categories.data]);
  const featured = useMemo(
    () =>
      FEATURED_SHELVES.map((slug) => findCategory(tree, slug))
        .filter((n): n is CategoryNode => !!n)
        .map((shelf) => ({ shelf, parent: (categories.data ?? []).find((c) => c.id === shelf.parent_id) as CategoryNode | undefined })),
    [tree, categories.data],
  );

  if (categories.isLoading) return <div className="py-20 text-center"><Spinner /></div>;

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
          <p className="mt-2 max-w-xl text-ivory/80">Fruits, vegetables, dairy, snacks, beauty and household essentials from your nearest RATION store.</p>
        </section>
      )}

      <section className="space-y-8">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Shop by category</h2>
          <Link href="/categories" className="text-sm font-semibold text-primary">See all</Link>
        </div>
        {tree.map((dept) => (
          <div key={dept.id}>
            <h3 className="mb-3 text-base font-bold text-ink">{dept.name}</h3>
            <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8">
              {dept.children.map((c) => (
                <CategoryTile key={c.id} node={c} icon={categoryIcon(tree, c.slug)} />
              ))}
            </div>
          </div>
        ))}
        {tree.length === 0 ? <p className="py-10 text-center text-muted">No categories yet.</p> : null}
      </section>

      {featured.map(({ shelf, parent }) => (
        <ShelfRail key={shelf.id} storeId={storeId} shelf={shelf} parent={parent} />
      ))}
    </div>
  );
}

export default function HomePage() {
  return <StoreGate>{(storeId) => <Storefront storeId={storeId} />}</StoreGate>;
}
