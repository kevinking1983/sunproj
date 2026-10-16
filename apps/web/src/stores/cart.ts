"use client";

import type { Product } from "@ration/api";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface CartLine {
  productId: string;
  slug: string;
  name: string;
  unit_label: string;
  image: string | null;
  price: number;
  mrp: number;
  quantity: number;
  available: number;
}

interface CartState {
  storeId: string | null;
  lines: Record<string, CartLine>;
  couponCode: string | null;
  tip: number;
  open: boolean;
  add: (product: Product, storeId: string) => void;
  increment: (productId: string) => void;
  decrement: (productId: string) => void;
  remove: (productId: string) => void;
  setCoupon: (code: string | null) => void;
  setTip: (paise: number) => void;
  setOpen: (open: boolean) => void;
  clear: () => void;
}

export const MAX_PER_LINE = 50;

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      storeId: null,
      lines: {},
      couponCode: null,
      tip: 0,
      open: false,

      add: (p, storeId) => {
        const current = get();
        const lines = current.storeId && current.storeId !== storeId ? {} : { ...current.lines };
        const existing = lines[p.id];
        if (existing) {
          lines[p.id] = { ...existing, quantity: Math.min(existing.quantity + 1, existing.available, MAX_PER_LINE) };
        } else if (p.available > 0) {
          lines[p.id] = { productId: p.id, slug: p.slug, name: p.name, unit_label: p.unit_label, image: p.images[0] ?? null, price: p.price, mrp: p.mrp, quantity: 1, available: p.available };
        }
        set({ lines, storeId });
      },
      increment: (id) => {
        const line = get().lines[id];
        if (!line) return;
        set({ lines: { ...get().lines, [id]: { ...line, quantity: Math.min(line.quantity + 1, line.available, MAX_PER_LINE) } } });
      },
      decrement: (id) => {
        const line = get().lines[id];
        if (!line) return;
        if (line.quantity <= 1) return get().remove(id);
        set({ lines: { ...get().lines, [id]: { ...line, quantity: line.quantity - 1 } } });
      },
      remove: (id) => {
        const rest = { ...get().lines };
        delete rest[id];
        set({ lines: rest });
      },
      setCoupon: (couponCode) => set({ couponCode }),
      setTip: (tip) => set({ tip }),
      setOpen: (open) => set({ open }),
      clear: () => set({ lines: {}, couponCode: null, tip: 0 }),
    }),
    { name: "ration.cart", storage: createJSONStorage(() => localStorage), partialize: (s) => ({ storeId: s.storeId, lines: s.lines, couponCode: s.couponCode, tip: s.tip }) },
  ),
);

export const selectLines = (s: CartState) => Object.values(s.lines);
export const selectCount = (s: CartState) => Object.values(s.lines).reduce((n, l) => n + l.quantity, 0);
export const selectSubtotal = (s: CartState) => Object.values(s.lines).reduce((n, l) => n + l.price * l.quantity, 0);
export const selectQuantity = (productId: string) => (s: CartState) => s.lines[productId]?.quantity ?? 0;
