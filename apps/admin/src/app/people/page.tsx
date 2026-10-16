"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Spinner, Table, fmtDate } from "@/components/ui";
import { admin, describeError, qk } from "@/lib/api";
import { useAuth } from "@/stores/auth";
import { formatInr } from "@ration/shared";

const ROLES = ["customer", "rider", "store_staff", "admin"] as const;

export default function PeoplePage() {
  const qc = useQueryClient();
  const me = useAuth((s) => s.profile);
  const people = useQuery({ queryKey: qk.customers, queryFn: () => admin.people.customers(300) });
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const setRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: (typeof ROLES)[number] }) => admin.people.setRole(id, role),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: qk.customers }); void qc.invalidateQueries({ queryKey: qk.riders }); },
    onError: (e) => setError(describeError(e)),
  });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl font-bold">People</h1><input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search name or phone" className="ml-auto h-9 rounded-lg border border-border bg-surface px-3 text-sm" /></div>
      <p className="text-sm text-muted">Riders and store staff are regular accounts with a role. Only admins can change roles.</p>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {people.isLoading ? <Spinner /> : (
        <Table head={["Person", "Phone", "Role", "Wallet", "Joined"]}>
          {(people.data ?? []).filter((p) => `${p.full_name ?? ""} ${p.phone ?? ""}`.toLowerCase().includes(filter.toLowerCase())).map((p) => (
            <tr key={p.id}>
              <td className="px-3 py-2 font-medium">{p.full_name ?? "—"}</td>
              <td className="px-3 py-2 text-muted">{p.phone}</td>
              <td className="px-3 py-2">
                {me?.role === "admin" ? (
                  <select value={p.role} onChange={(e) => setRole.mutate({ id: p.id, role: e.target.value as (typeof ROLES)[number] })} className="h-8 rounded border border-border bg-surface px-2 text-sm">{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</select>
                ) : <span>{p.role}</span>}
              </td>
              <td className="px-3 py-2">{formatInr(p.wallet_balance)}</td>
              <td className="px-3 py-2 text-muted">{fmtDate(p.created_at)}</td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
