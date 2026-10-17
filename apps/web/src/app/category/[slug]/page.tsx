"use client";

import { buildCategoryTree, categoryIcon, categoryPath, descendantIds, type CategoryNode } from "@ration/api";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";

import { CategoryTile } from "@/components/catalog/CategoryTile";
import { ProductGrid } from "@/components/catalog/ProductCard";
import { StoreGate } from "@/components/catalog/StoreGate";
import { Empty, Spinner } from "@/components/ui";
import { catalogApi, queryKeys } from "@/lib/api";

function Breadcrumbs({ path }: { path: CategoryNode[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-xs text-muted">
      <Link href="/" className="hover:text-primary">Home</Link>
      {path.map((n, i) => (
        <span key={n.id}>
          {" / "}
          {i === path.length - 1 ? <span className="text-ink">{n.name}</span> : <Link href={`/category/${n.slug}`} className="hover:text-primary">{n.name}</Link>}
        </span>
      ))}
    </nav>
  );
}

/** A category: subcategory rail on the left ("All" first), products on the right. */
function ShelfBrowser({ storeId, tree, category, selected }: { storeId: string; tree: CategoryNode[]; category: CategoryNode; selected: CategoryNode | null }) {
  const router = useRouter();
  const ids = useMemo(() => (selected ? [selected.id] : descendantIds(category)), [selected, category]);
  const products = useQuery({ queryKey: queryKeys.products(storeId, `shelves:${ids.join(",")}`), queryFn: () => catalogApi.products(storeId, ids, selected ? 200 : 120) });
  const shelves = [{ id: "all", slug: null, name: `All ${category.name}`, image_url: category.image_url }, ...category.children.map((c) => ({ id: c.id, slug: c.slug, name: c.name, image_url: c.image_url }))];
  const icon = categoryIcon(tree, category.slug);
  const active = selected?.slug ?? null;

  return (
    <div className="mt-4 flex gap-3 sm:gap-6">
      <aside className="w-20 shrink-0 sm:w-52" aria-label={`${category.name} sections`}>
        <ul className="sticky top-20 max-h-[calc(100vh-6rem)] space-y-1 overflow-y-auto pb-6">
          {shelves.map((s) => {
            const on = s.slug === active;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => router.replace(s.slug ? `/category/${category.slug}?sub=${s.slug}` : `/category/${category.slug}`, { scroll: false })}
                  aria-current={on ? "true" : undefined}
                  className={`flex w-full flex-col items-center gap-1 rounded-xl border-l-4 px-1 py-2 text-center text-[11px] leading-tight sm:flex-row sm:gap-3 sm:px-2 sm:text-left sm:text-sm ${on ? "border-primary bg-primary-tint font-semibold text-primary" : "border-transparent hover:bg-surface-muted"}`}
                >
                  <span className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-primary-tint sm:h-10 sm:w-10">
                    {s.image_url ? <Image src={s.image_url} alt="" fill sizes="48px" className="object-cover" unoptimized /> : <span className="text-xl" aria-hidden>{icon}</span>}
                  </span>
                  <span className="line-clamp-2">{s.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>
      <div className="min-w-0 flex-1">
        <h2 className="mb-3 text-lg font-bold">{selected ? selected.name : `All ${category.name}`}</h2>
        {products.isLoading ? <div className="py-20 text-center"><Spinner /></div> : products.data?.length ? <ProductGrid products={products.data} /> : <Empty title="Nothing stocked here yet" body="Try another section, or check back soon." />}
      </div>
    </div>
  );
}

function CategoryListing({ storeId, slug }: { storeId: string; slug: string }) {
  const params = useSearchParams();
  const categories = useQuery({ queryKey: queryKeys.categories, queryFn: catalogApi.categories });
  const tree = useMemo(() => buildCategoryTree(categories.data ?? []), [categories.data]);
  const path = useMemo(() => categoryPath(tree, slug), [tree, slug]);

  if (categories.isLoading) return <div className="py-20 text-center"><Spinner /></div>;
  const node = path[path.length - 1];
  if (!node) return <Empty title="Category not found" action="Back to home" href="/" />;

  // Department: its categories as tiles.
  if (node.depth === 0) {
    return (
      <div className="py-6">
        <Breadcrumbs path={path} />
        <h1 className="mt-2 text-2xl font-bold">{node.name}</h1>
        <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-8">
          {node.children.map((c) => <CategoryTile key={c.id} node={c} icon={categoryIcon(tree, c.slug)} />)}
        </div>
      </div>
    );
  }

  // A subcategory opens its category with that section selected; ?sub= picks a section too.
  const category = node.depth >= 2 ? path[1] : node;
  const subSlug = node.depth >= 2 ? node.slug : params.get("sub");
  const selected = category.children.find((c) => c.slug === subSlug) ?? null;
  return (
    <div className="py-6">
      <Breadcrumbs path={selected ? [...path.slice(0, 2), selected] : path.slice(0, 2)} />
      <h1 className="mt-2 text-2xl font-bold">{category.name}</h1>
      {category.description ? <p className="mt-1 text-sm text-muted">{category.description}</p> : null}
      <ShelfBrowser storeId={storeId} tree={tree} category={category} selected={selected} />
    </div>
  );
}

export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  return (
    <StoreGate>
      {(storeId) => (
        <Suspense fallback={<div className="py-20 text-center"><Spinner /></div>}>
          <CategoryListing storeId={storeId} slug={slug} />
        </Suspense>
      )}
    </StoreGate>
  );
}
