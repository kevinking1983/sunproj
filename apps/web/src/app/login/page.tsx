"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { Button, TextField } from "@/components/ui";
import { formatIndianMobile, normaliseIndianMobile } from "@/lib/phone";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/stores/auth";

function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next") ?? "/";
  const status = useAuth((s) => s.status);
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (status === "signed_in") router.replace(next);
  }, [status, next, router]);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  const sendOtp = async () => {
    const e164 = normaliseIndianMobile(phone);
    if (!e164) return setError("Enter a valid 10-digit Indian mobile number");
    setError(null);
    setLoading(true);
    const { error: e } = await supabase.auth.signInWithOtp({ phone: e164, options: { channel: "sms" } });
    setLoading(false);
    if (e) return setError(e.message);
    setSent(e164);
    setSeconds(30);
  };

  const verify = async () => {
    if (!sent || code.length !== 6) return;
    setLoading(true);
    setError(null);
    const { error: e } = await supabase.auth.verifyOtp({ phone: sent, token: code, type: "sms" });
    setLoading(false);
    if (e) {
      setError("That code did not match. Try again.");
      setCode("");
    }
  };

  return (
    <div className="mx-auto max-w-md py-10">
      <div className="rounded-card border border-border bg-surface p-6">
        <h1 className="text-2xl font-bold">{sent ? "Enter the code" : "Log in or sign up"}</h1>
        <p className="mt-1 text-sm text-muted">{sent ? `Sent to ${formatIndianMobile(sent)}` : "We will send a one-time password to your number."}</p>
        {!sent ? (
          <form className="mt-5 space-y-4" onSubmit={(e) => { e.preventDefault(); void sendOtp(); }}>
            <TextField label="Mobile number" name="phone" prefix="+91" inputMode="numeric" autoComplete="tel" maxLength={10} placeholder="98765 43210" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} error={error} autoFocus />
            <Button type="submit" variant="accent" size="lg" full loading={loading}>Continue</Button>
            <p className="text-center text-xs text-muted">By continuing you agree to the RATION Terms of Service and Privacy Policy.</p>
          </form>
        ) : (
          <form className="mt-5 space-y-4" onSubmit={(e) => { e.preventDefault(); void verify(); }}>
            <TextField label="6-digit code" name="otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 6); setCode(v); }} error={error} autoFocus className="tracking-[0.5em] text-xl" />
            <Button type="submit" variant="accent" size="lg" full loading={loading} disabled={code.length !== 6}>Verify</Button>
            <div className="flex justify-between text-sm">
              <button type="button" className="text-muted hover:text-primary" onClick={() => { setSent(null); setCode(""); setError(null); }}>Change number</button>
              <button type="button" className="font-semibold text-primary disabled:text-muted" disabled={seconds > 0} onClick={sendOtp}>{seconds > 0 ? `Resend in ${seconds}s` : "Resend code"}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}
