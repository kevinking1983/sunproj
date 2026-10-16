"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";

import { Spinner } from "@/components/ui";
import { catalogApi, queryKeys } from "@/lib/api";

export default function CategoriesPage() {
  const categories = useQuery({ queryKey: queryKeys.categories, queryFn: catalogApi.categories });
  if (categories.isLoading) return <div className="py-20 text-center"><Spinner /></div>;
  const all = categories.data ?? [];
  const groups = all.filter((c) => !c.parent_id).map((p) => ({ parent: p, children: all.filter((c) => c.parent_id === p.id) }));
  return (
    <div className="space-y-8 py-6">
      <h1 className="text-2xl font-bold">All categories</h1>
      {groups.map(({ parent, children }) => (
        <section key={parent.id}>
          <h2 className="mb-3 text-lg font-semibold">{parent.name}</h2>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-7">
            {[parent, ...children].map((c) => (
              <Link key={c.id} href={`/category/${c.slug}`} className="flex flex-col items-center gap-2 text-center">
                <span className="relative aspect-square w-full overflow-hidden rounded-card bg-primary-tint">{c.image_url ? <Image src={c.image_url} alt="" fill className="object-cover" unoptimized /> : null}</span>
                <span className="line-clamp-2 text-xs font-medium">{c.id === parent.id ? `All ${c.name}` : c.name}</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
