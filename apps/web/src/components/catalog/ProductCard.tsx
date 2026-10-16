"use client";

import type { Product } from "@ration/api";
import Image from "next/image";
import Link from "next/link";

import { selectQuantity, useCart } from "@/stores/cart";
import { useLocation } from "@/stores/location";
import { formatInr } from "@ration/shared";

export const discountPercent = (p: Pick<Product, "mrp" | "price">) => (p.mrp > p.price ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : 0);

export function ProductImage({ uri, alt, size = 160, className = "" }: { uri?: string | null; alt: string; size?: number; className?: string }) {
  if (!uri) {
    return (
      <div className={`grid place-items-center rounded-xl bg-primary-tint text-primary-light ${className}`} style={{ width: size, height: size }} aria-hidden>
        <svg width={size * 0.4} height={size * 0.4} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 9h18l-1.5 11h-15L3 9Zm4 0 3-6m7 6-3-6" /></svg>
      </div>
    );
  }
  return <Image src={uri} alt={alt} width={size} height={size} className={`rounded-xl object-cover ${className}`} style={{ width: size, height: size }} unoptimized />;
}

export function AddButton({ product, compact }: { product: Product; compact?: boolean }) {
  const quantity = useCart(selectQuantity(product.id));
  const { add, increment, decrement } = useCart();
  const storeId = useLocation((s) => s.store?.id);
  const h = compact ? "h-8" : "h-9";
  if (product.available <= 0) return <span className={`inline-flex ${h} min-w-[76px] items-center justify-center rounded-lg border border-border bg-surface-muted px-2 text-xs text-muted`}>Out of stock</span>;
  if (quantity === 0) {
    return (
      <button type="button" onClick={() => storeId && add(product, storeId)} disabled={!storeId} className={`inline-flex ${h} min-w-[76px] items-center justify-center rounded-lg border-[1.5px] border-primary bg-surface px-3 text-sm font-bold text-primary hover:bg-primary-tint disabled:opacity-50`} aria-label={`Add ${product.name} to cart`}>
        ADD
      </button>
    );
  }
  return (
    <span className={`inline-flex ${h} min-w-[76px] items-center justify-between rounded-lg bg-primary text-white`}>
      <button type="button" onClick={() => decrement(product.id)} className="h-full w-7 font-bold" aria-label="Remove one">−</button>
      <span className="text-sm font-bold">{quantity}</span>
      <button type="button" onClick={() => increment(product.id)} disabled={quantity >= product.available} className="h-full w-7 font-bold disabled:opacity-40" aria-label="Add one">+</button>
    </span>
  );
}

export function ProductCard({ product }: { product: Product }) {
  const off = discountPercent(product);
  return (
    <article className="flex flex-col gap-1 rounded-card border border-border bg-surface p-3">
      <Link href={`/product/${product.slug}`} className="relative self-center">
        <ProductImage uri={product.images[0]} alt={product.name} size={140} />
        {off > 0 ? <span className="absolute left-0 top-0 rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold text-ink">{off}% OFF</span> : null}
      </Link>
      <Link href={`/product/${product.slug}`} className="line-clamp-2 min-h-[2.5rem] text-sm font-medium hover:text-primary">{product.name}</Link>
      <span className="text-xs text-muted">{product.unit_label}</span>
      <div className="mt-1 flex items-end justify-between gap-2">
        <span>
          <span className="block text-sm font-bold">{formatInr(product.price)}</span>
          {off > 0 ? <span className="block text-xs text-muted line-through">{formatInr(product.mrp)}</span> : null}
        </span>
        <AddButton product={product} compact />
      </div>
    </article>
  );
}

export function ProductGrid({ products }: { products: Product[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
