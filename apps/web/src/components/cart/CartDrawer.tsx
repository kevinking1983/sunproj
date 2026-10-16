"use client";

import Link from "next/link";

import { ProductImage } from "@/components/catalog/ProductCard";
import { Button } from "@/components/ui";
import { selectLines, selectSubtotal, useCart } from "@/stores/cart";
import { useLocation } from "@/stores/location";
import { formatInr } from "@ration/shared";

export function CartDrawer() {
  const { open, setOpen, increment, decrement } = useCart();
  const lines = useCart(selectLines);
  const subtotal = useCart(selectSubtotal);
  const store = useLocation((s) => s.store);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-primary-dark/60" onClick={() => setOpen(false)}>
      <aside className="flex h-full w-full max-w-md flex-col bg-ivory shadow-xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Cart">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-lg font-bold">Your cart</h2>
          <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-2 py-1 text-muted hover:bg-surface-muted" aria-label="Close cart">✕</button>
        </div>
        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
            <p className="text-lg font-semibold">Your cart is empty</p>
            <p className="text-sm text-muted">Add fresh groceries and we will bring them in minutes.</p>
            <Button onClick={() => setOpen(false)}>Start shopping</Button>
          </div>
        ) : (
          <>
            {store ? <p className="bg-primary-tint px-4 py-2 text-sm font-medium text-primary">Delivery in {store.promised_minutes} minutes from {store.name}</p> : null}
            <ul className="flex-1 divide-y divide-divider overflow-y-auto px-4">
              {lines.map((l) => (
                <li key={l.productId} className="flex items-center gap-3 py-3">
                  <ProductImage uri={l.image} alt={l.name} size={56} />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-medium">{l.name}</p>
                    <p className="text-xs text-muted">{l.unit_label}</p>
                    <p className="text-sm font-bold">{formatInr(l.price * l.quantity)}</p>
                  </div>
                  <span className="inline-flex h-8 min-w-[84px] items-center justify-between rounded-lg bg-primary text-white">
                    <button type="button" onClick={() => decrement(l.productId)} className="h-full w-7 font-bold" aria-label="Remove one">{l.quantity === 1 ? "🗑" : "−"}</button>
                    <span className="text-sm font-bold">{l.quantity}</span>
                    <button type="button" onClick={() => increment(l.productId)} disabled={l.quantity >= l.available} className="h-full w-7 font-bold disabled:opacity-40" aria-label="Add one">+</button>
                  </span>
                </li>
              ))}
            </ul>
            <div className="border-t border-border bg-surface p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-muted">Items total</span>
                <span className="text-lg font-bold">{formatInr(subtotal)}</span>
              </div>
              <Link href="/checkout" onClick={() => setOpen(false)} className="block rounded-xl bg-accent py-3 text-center font-bold text-ink hover:brightness-95">
                Go to checkout
              </Link>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
