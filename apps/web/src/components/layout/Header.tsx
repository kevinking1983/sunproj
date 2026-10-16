"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useAuth } from "@/stores/auth";
import { selectCount, selectSubtotal, useCart } from "@/stores/cart";
import { useLocation } from "@/stores/location";
import { formatInr } from "@ration/shared";

import { useLocationModal } from "@/components/location/LocationModal";

export function Header() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const { location, store, status } = useLocation();
  const openLocation = useLocationModal((s) => s.open);
  const count = useCart(selectCount);
  const subtotal = useCart(selectSubtotal);
  const setCartOpen = useCart((s) => s.setOpen);
  const authStatus = useAuth((s) => s.status);
  const profile = useAuth((s) => s.profile);

  return (
    <header className="sticky top-0 z-30 bg-primary-dark text-ivory shadow-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2" aria-label="RATION home">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent text-lg font-black text-ink">R</span>
          <span className="hidden text-xl font-extrabold tracking-wide sm:inline">RATION</span>
        </Link>

        <button type="button" onClick={() => openLocation()} className="flex min-w-0 flex-1 flex-col items-start rounded-lg px-2 py-1 text-left hover:bg-white/10 sm:flex-none sm:max-w-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-accent">
            {status === "ready" && store ? `Delivery in ${store.promised_minutes} min` : status === "unserviceable" ? "Not serviceable" : "Set location"}
          </span>
          <span className="w-full truncate text-sm">{location ? location.label : "Choose a delivery address"} ▾</span>
        </button>

        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
          }}
          className="order-last w-full sm:order-none sm:flex-1"
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search for atta, milk, chips…"
            aria-label="Search products"
            className="h-11 w-full rounded-xl border-0 bg-surface px-4 text-[15px] text-ink outline-none placeholder:text-muted focus:ring-2 focus:ring-accent"
          />
        </form>

        <nav className="flex items-center gap-2">
          {authStatus === "signed_in" ? (
            <Link href="/account" className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-white/10">
              {profile?.full_name?.split(" ")[0] ?? "Account"}
            </Link>
          ) : (
            <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-white/10">
              Log in
            </Link>
          )}
          <button type="button" onClick={() => setCartOpen(true)} className="flex items-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm font-bold text-ink" aria-label={`Cart, ${count} items`}>
            <span aria-hidden>🛒</span>
            {count > 0 ? (
              <span className="flex flex-col leading-tight">
                <span className="text-xs font-semibold">{count} {count === 1 ? "item" : "items"}</span>
                <span>{formatInr(subtotal)}</span>
              </span>
            ) : (
              <span>Cart</span>
            )}
          </button>
        </nav>
      </div>
    </header>
  );
}
