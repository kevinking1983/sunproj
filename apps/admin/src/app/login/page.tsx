"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button, Field } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/stores/auth";

const normalise = (input: string) => {
  const d = input.replace(/\D/g, "");
  const local = d.length === 12 && d.startsWith("91") ? d.slice(2) : d;
  return /^[6-9]\d{9}$/.test(local) ? `91${local}` : null;
};

export default function LoginPage() {
  const router = useRouter();
  const status = useAuth((s) => s.status);
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === "signed_in") router.replace("/");
  }, [status, router]);

  const send = async () => {
    const e164 = normalise(phone);
    if (!e164) return setError("Enter a valid 10-digit mobile number");
    setLoading(true);
    setError(null);
    const { error: e } = await supabase.auth.signInWithOtp({ phone: e164, options: { channel: "sms", shouldCreateUser: false } });
    setLoading(false);
    if (e) return setError(e.message.includes("Signups not allowed") ? "This number is not a staff account." : e.message);
    setSent(e164);
  };

  const verify = async () => {
    if (!sent) return;
    setLoading(true);
    const { error: e } = await supabase.auth.verifyOtp({ phone: sent, token: code, type: "sms" });
    setLoading(false);
    if (e) setError("That code did not match.");
  };

  return (
    <div className="grid min-h-screen place-items-center bg-primary-dark p-4">
      <form onSubmit={(e) => { e.preventDefault(); void (sent ? verify() : send()); }} className="w-full max-w-sm space-y-4 rounded-card bg-ivory p-6">
        <div><p className="text-xs font-semibold uppercase tracking-widest text-gold-text">RATION Admin</p><h1 className="text-xl font-bold">{sent ? "Enter the code" : "Staff login"}</h1></div>
        {!sent ? <Field label="Mobile number" inputMode="numeric" maxLength={10} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} error={error} autoFocus /> : <Field label="6-digit OTP" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} error={error} autoFocus />}
        <Button type="submit" variant="accent" className="w-full" loading={loading}>{sent ? "Verify" : "Send OTP"}</Button>
        {sent ? <button type="button" className="w-full text-center text-xs text-muted" onClick={() => { setSent(null); setCode(""); }}>Change number</button> : null}
      </form>
    </div>
  );
}
