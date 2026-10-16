import { Stack, router } from "expo-router";
import { useState } from "react";

import { Button, Screen, TextField, Typography } from "@/components/ui";
import { spacing } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/stores/auth";

export default function ProfileScreen() {
  const profile = useAuth((s) => s.profile);
  const refreshProfile = useAuth((s) => s.refreshProfile);
  const [name, setName] = useState(profile?.full_name ?? "");
  const [email, setEmail] = useState(profile?.email ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [referral, setReferral] = useState("");
  const [referralMsg, setReferralMsg] = useState<string | null>(null);

  const applyReferral = async () => {
    const code = referral.trim().toUpperCase();
    if (!code) return;
    const { data, error: e } = await supabase.rpc("apply_referral_code", { p_code: code });
    if (e) return setReferralMsg(e.message);
    setReferralMsg(data ? "Referral applied. You both get ₹50 after your first delivered order." : "That code is not valid or you already used one.");
  };

  const save = async () => {
    if (!profile) return;
    if (name.trim().length < 2) return setError("Enter your name");
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setError("Enter a valid email address");
    setSaving(true);
    setError(null);
    const { error: e } = await supabase.from("profiles").update({ full_name: name.trim(), email: email.trim() || null }).eq("id", profile.id);
    setSaving(false);
    if (e) return setError(e.message);
    await refreshProfile();
    router.back();
  };

  return (
    <Screen scroll keyboard edges={[]}>
      <Stack.Screen options={{ title: "Your profile" }} />
      <Typography tone="muted" style={{ marginBottom: spacing.lg }}>Your name is used on invoices and by the delivery partner.</Typography>
      <TextField label="Full name" value={name} onChangeText={setName} autoCapitalize="words" textContentType="name" />
      <TextField label="Email (optional)" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" textContentType="emailAddress" hint="For order invoices" />
      {error ? <Typography variant="label" tone="danger">{error}</Typography> : null}
      <Button title="Save" variant="accent" size="lg" fullWidth loading={saving} onPress={save} style={{ marginTop: spacing.xl }} />

      <Typography variant="heading" style={{ marginTop: spacing.xxxl, marginBottom: spacing.sm }}>Have a referral code?</Typography>
      <TextField placeholder="Referral code" value={referral} onChangeText={setReferral} autoCapitalize="characters" autoCorrect={false} hint={referralMsg ?? "Applies once, before your first delivered order"} />
      <Button title="Apply code" variant="secondary" onPress={applyReferral} style={{ marginTop: spacing.sm }} />
    </Screen>
  );
}
