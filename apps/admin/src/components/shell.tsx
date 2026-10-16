"use client";

import { useQuery, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { admin, qk } from "@/lib/api";
import { isStaff, useAuth } from "@/stores/auth";

import { Button, Spinner } from "./ui";

const NAV = [
  ["/", "Dashboard"],
  ["/orders", "Orders"],
  ["/inventory", "Inventory"],
  ["/products", "Products"],
  ["/categories", "Categories"],
  ["/coupons", "Coupons"],
  ["/banners", "Banners"],
  ["/stores", "Stores"],
  ["/people", "People"],
] as const;

function Gate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { status, profile, storeId, setStoreId, signOut } = useAuth();
  const stores = useQuery({ queryKey: qk.stores, queryFn: admin.stores.list, enabled: status === "signed_in" && isStaff(profile) });

  useEffect(() => {
    if (status === "signed_out" && pathname !== "/login") router.replace("/login");
  }, [status, pathname, router]);

  if (pathname === "/login") return <>{children}</>;
  if (status === "loading") return <div className="grid min-h-screen place-items-center"><Spinner /></div>;
  if (status === "signed_out") return null;
  if (!isStaff(profile)) {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div>
          <h1 className="text-xl font-bold">Staff access only</h1>
          <p className="mt-2 text-muted">This account ({profile?.phone}) is not a store staff or admin account. Ask an admin to grant access.</p>
          <Button className="mt-4" variant="secondary" onClick={() => signOut()}>Log out</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 shrink-0 flex-col bg-primary-dark text-ivory md:flex">
        <div className="px-5 py-5 text-lg font-extrabold tracking-wide"><span className="mr-2 inline-grid h-7 w-7 place-items-center rounded bg-accent text-sm text-ink">R</span>RATION Admin</div>
        <nav className="flex-1 space-y-0.5 px-3">
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} className={`block rounded-lg px-3 py-2 text-sm ${pathname === href ? "bg-white/15 font-semibold" : "hover:bg-white/10"}`}>{label}</Link>
          ))}
        </nav>
        <div className="border-t border-white/10 p-3 text-xs">
          <p className="truncate font-medium">{profile?.full_name ?? profile?.phone}</p>
          <p className="text-ivory/60">{profile?.role}</p>
          <button type="button" onClick={() => signOut()} className="mt-2 text-accent hover:underline">Log out</button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-border bg-surface px-4 py-2">
          <nav className="no-scrollbar flex gap-1 overflow-x-auto md:hidden">
            {NAV.map(([href, label]) => <Link key={href} href={href} className={`shrink-0 rounded px-2 py-1 text-xs ${pathname === href ? "bg-primary text-white" : "text-muted"}`}>{label}</Link>)}
          </nav>
          <div className="ml-auto flex items-center gap-2 text-sm">
            <span className="text-muted">Store</span>
            <select value={storeId ?? ""} onChange={(e) => setStoreId(e.target.value || null)} className="h-9 rounded-lg border border-border bg-surface px-2">
              <option value="">All stores</option>
              {(stores.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, retry: 1 } } }));
  const initialise = useAuth((s) => s.initialise);
  useEffect(() => initialise(), [initialise]);
  return <QueryClientProvider client={client}><Gate>{children}</Gate></QueryClientProvider>;
}
