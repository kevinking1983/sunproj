"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { ProductGrid } from "@/components/catalog/ProductCard";
import { StoreGate } from "@/components/catalog/StoreGate";
import { Empty, Spinner } from "@/components/ui";
import { catalogApi, queryKeys } from "@/lib/api";

function Results({ storeId }: { storeId: string }) {
  const q = (useSearchParams().get("q") ?? "").trim();
  const results = useQuery({ queryKey: queryKeys.search(storeId, q), queryFn: () => catalogApi.search(storeId, q), enabled: q.length >= 2 });
  if (q.length < 2) return <Empty title="Search for products" body="Try milk, atta, chips or your favourite brand." />;
  if (results.isLoading) return <div className="py-20 text-center"><Spinner /></div>;
  return (
    <div className="py-6">
      <h1 className="mb-4 text-xl font-bold">Results for “{q}”</h1>
      {results.data?.length ? <ProductGrid products={results.data} /> : <Empty title={`No results for “${q}”`} body="Try a different spelling or browse categories." action="Browse categories" href="/categories" />}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center"><Spinner /></div>}>
      <StoreGate>{(storeId) => <Results storeId={storeId} />}</StoreGate>
    </Suspense>
  );
}
