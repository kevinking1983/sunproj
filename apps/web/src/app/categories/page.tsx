"use client";

import { buildCategoryTree, categoryIcon } from "@ration/api";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo } from "react";

import { CategoryTile } from "@/components/catalog/CategoryTile";
import { Spinner } from "@/components/ui";
import { catalogApi, queryKeys } from "@/lib/api";

export default function CategoriesPage() {
  const categories = useQuery({ queryKey: queryKeys.categories, queryFn: catalogApi.categories });
  const tree = useMemo(() => buildCategoryTree(categories.data ?? []), [categories.data]);
  if (categories.isLoading) return <div className="py-20 text-center"><Spinner /></div>;
  return (
    <div className="space-y-10 py-6">
      <h1 className="text-2xl font-bold">All categories</h1>
      {tree.map((dept) => (
        <section key={dept.id}>
          <h2 className="mb-4 text-lg font-bold">{dept.name}</h2>
          <div className="grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {dept.children.map((c) => (
              <div key={c.id} className="flex gap-4">
                <div className="w-24 shrink-0"><CategoryTile node={c} icon={categoryIcon(tree, c.slug)} label="" /></div>
                <div className="min-w-0">
                  <Link href={`/category/${c.slug}`} className="font-semibold hover:text-primary">{c.name}</Link>
                  <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted">
                    {c.children.map((s) => (
                      <li key={s.id}><Link href={`/category/${c.slug}?sub=${s.slug}`} className="hover:text-primary">{s.name}</Link></li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
