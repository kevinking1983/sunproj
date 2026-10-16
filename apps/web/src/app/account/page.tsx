"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button, Card, Spinner, TextField, formatDate } from "@/components/ui";
import { profileApi, queryKeys } from "@/lib/api";
import { formatIndianMobile } from "@/lib/phone";
import { useAuth } from "@/stores/auth";
import { formatInr } from "@ration/shared";

const KIND: Record<string, string> = { refund: "Refund", referral: "Referral reward", cashback: "Cashback", order_debit: "Order payment", adjustment: "Adjustment" };

function ProfileForm({ userId, initialName, initialEmail, onSaved }: { userId: string; initialName: string; initialEmail: string; onSaved: () => void }) {
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const save = useMutation({
    mutationFn: () => profileApi.update(userId, { full_name: name.trim(), email: email.trim() || null }),
    onSuccess: onSaved,
  });
  return (
    <Card>
      <h2 className="font-semibold">Profile</h2>
      <form className="mt-3 space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <TextField label="Full name" name="full_name" value={name} onChange={(e) => setName(e.target.value)} />
        <TextField label="Email (optional)" name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} hint="For order invoices" />
        {save.isError ? <p className="text-sm text-danger">{(save.error as Error).message}</p> : null}
        <Button type="submit" loading={save.isPending}>Save</Button>
      </form>
    </Card>
  );
}

export default function AccountPage() {
  const router = useRouter();
  const { status, profile, signOut, refreshProfile } = useAuth();
  const userId = useAuth((s) => s.session?.user.id ?? "");
  const [referral, setReferral] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (status === "signed_out") router.replace("/login?next=/account");
  }, [status, router]);

  const wallet = useQuery({ queryKey: queryKeys.wallet(userId), queryFn: profileApi.walletTransactions, enabled: !!userId });
  const apply = useMutation({
    mutationFn: () => profileApi.applyReferral(referral),
    onSuccess: (ok) => setMsg(ok ? "Referral applied. You both get ₹50 after your first delivered order." : "That code is not valid or you already used one."),
  });

  if (!profile) return <div className="py-20 text-center"><Spinner /></div>;

  return (
    <div className="grid gap-6 py-6 md:grid-cols-2">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">{profile.full_name ?? "Your account"}</h1>
        <p className="-mt-4 text-muted">{profile.phone ? formatIndianMobile(profile.phone) : ""}</p>
        <ProfileForm key={`${profile.id}:${profile.full_name ?? ""}:${profile.email ?? ""}`} userId={userId} initialName={profile.full_name ?? ""} initialEmail={profile.email ?? ""} onSaved={() => { void refreshProfile(); setMsg("Saved."); }} />
        <Card>
          <h2 className="font-semibold">Refer friends, earn rewards</h2>
          <p className="mt-1 text-sm text-muted">Share your code <b className="text-ink">{profile.referral_code}</b>. They get ₹50 off their first order and you get ₹50 after it is delivered.</p>
          <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); apply.mutate(); }}>
            <div className="flex-1"><TextField name="referral" placeholder="Have a code? Enter it" value={referral} onChange={(e) => setReferral(e.target.value.toUpperCase())} /></div>
            <Button type="submit" variant="secondary" loading={apply.isPending}>Apply</Button>
          </form>
        </Card>
        {msg ? <p className="text-sm text-primary">{msg}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Link href="/account/orders" className="rounded-xl bg-primary px-4 py-2 font-semibold text-white">Your orders</Link>
          <Link href="/contact" className="rounded-xl border border-primary px-4 py-2 font-semibold text-primary">Help and support</Link>
          <Button variant="ghost" onClick={() => signOut().then(() => router.replace("/"))}>Log out</Button>
        </div>
      </div>
      <div className="space-y-6">
        <Card className="bg-primary-dark text-ivory">
          <p className="text-xs uppercase tracking-wide text-accent">RATION wallet</p>
          <p className="text-3xl font-bold">{formatInr(profile.wallet_balance)}</p>
          <p className="text-sm text-ivory/80">Refunds and rewards land here instantly. Use it at checkout.</p>
        </Card>
        <Card>
          <h2 className="font-semibold">Wallet activity</h2>
          <ul className="mt-2 divide-y divide-divider">
            {(wallet.data ?? []).map((t) => (
              <li key={t.id} className="flex items-center justify-between py-2 text-sm">
                <span><span className="block font-medium">{KIND[t.kind] ?? t.kind}</span><span className="text-xs text-muted">{t.note ?? ""} · {formatDate(t.created_at)}</span></span>
                <span className={`font-bold ${t.amount >= 0 ? "text-success" : ""}`}>{t.amount >= 0 ? "+" : "-"}{formatInr(Math.abs(t.amount))}</span>
              </li>
            ))}
            {wallet.data?.length === 0 ? <li className="py-4 text-center text-sm text-muted">No wallet activity yet.</li> : null}
          </ul>
        </Card>
      </div>
    </div>
  );
}
