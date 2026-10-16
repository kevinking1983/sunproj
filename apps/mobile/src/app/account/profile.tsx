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
    </Screen>
  );
}
