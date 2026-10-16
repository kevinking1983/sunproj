import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { Button, Screen, TextField, Typography } from "@/components/ui";
import { colors, radius, spacing } from "@/constants/theme";
import { addressesApi, type Address, type AddressInput, type AddressLabel } from "@/lib/api/addresses";
import { queryKeys } from "@/lib/query";
import { useAuth } from "@/stores/auth";
import { useLocation } from "@/stores/location";

const LABELS: { value: AddressLabel; title: string }[] = [
  { value: "home", title: "Home" },
  { value: "work", title: "Work" },
  { value: "other", title: "Other" },
];

/** Create (from the current resolved location) or edit (by id) a saved address. */
export default function AddressFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const userId = useAuth((s) => s.session?.user.id ?? "");
  const profile = useAuth((s) => s.profile);
  const location = useLocation((s) => s.location);

  const existing = useQuery({
    queryKey: queryKeys.addresses(userId),
    queryFn: addressesApi.list,
    enabled: !!userId && !!id,
    select: (rows) => rows.find((a) => a.id === id),
  });

  if (id && !existing.data) {
    return (
      <Screen edges={["top", "bottom"]}>
        {existing.isLoading ? <ActivityIndicator color={colors.primary} /> : <Typography tone="muted">Address not found.</Typography>}
      </Screen>
    );
  }

  const initial: AddressInput = existing.data
    ? (({ id: _id, user_id: _u, created_at: _c, ...rest }) => rest)(existing.data)
    : {
        label: "home",
        recipient_name: profile?.full_name ?? "",
        recipient_phone: profile?.phone ?? "",
        line1: "",
        line2: location?.line1 ?? "",
        landmark: "",
        city: location?.city ?? "",
        state: location?.state ?? "",
        pincode: location?.pincode ?? "",
        lat: location?.lat ?? 0,
        lng: location?.lng ?? 0,
        is_default: false,
      };

  return <AddressForm key={id ?? "new"} id={id} userId={userId} initial={initial} />;
}

function AddressForm({ id, userId, initial }: { id?: string; userId: string; initial: AddressInput }) {
  const location = useLocation((s) => s.location);
  const selectSavedAddress = useLocation((s) => s.selectSavedAddress);
  const qc = useQueryClient();
  const [form, setForm] = useState<AddressInput>(initial);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async (): Promise<Address> =>
      id ? addressesApi.update(userId, id, form) : addressesApi.create(userId, form),
    onSuccess: async (saved) => {
      await qc.invalidateQueries({ queryKey: queryKeys.addresses(userId) });
      await selectSavedAddress(saved);
      router.dismissAll();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Could not save address"),
  });

  const remove = useMutation({
    mutationFn: () => addressesApi.remove(id!),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.addresses(userId) });
      router.back();
    },
  });

  const submit = () => {
    if (!form.line1.trim()) return setError("Enter your house, flat or building");
    if (!/^[1-9][0-9]{5}$/.test(form.pincode)) return setError("Enter a valid 6-digit pincode");
    if (!form.lat || !form.lng) return setError("Pick a location first");
    setError(null);
    save.mutate();
  };

  const set = <K extends keyof AddressInput>(key: K, value: AddressInput[K]) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <Screen scroll keyboard edges={["top", "bottom"]}>
      <Typography variant="title">{id ? "Edit address" : "Save address"}</Typography>
      <Typography tone="muted" style={{ marginBottom: spacing.lg }}>{form.line2 || location?.line1}</Typography>

      <View style={styles.fields}>
        <TextField label="House / Flat / Building" value={form.line1} onChangeText={(v) => set("line1", v)} autoFocus={!id} />
        <TextField label="Area / Street" value={form.line2 ?? ""} onChangeText={(v) => set("line2", v)} />
        <TextField label="Landmark (optional)" value={form.landmark ?? ""} onChangeText={(v) => set("landmark", v)} />
        <View style={styles.inline}>
          <View style={{ flex: 1 }}><TextField label="City" value={form.city} onChangeText={(v) => set("city", v)} /></View>
          <View style={{ width: 130 }}><TextField label="Pincode" value={form.pincode} keyboardType="number-pad" maxLength={6} onChangeText={(v) => set("pincode", v.replace(/\D/g, ""))} /></View>
        </View>
        <TextField label="Receiver name" value={form.recipient_name ?? ""} onChangeText={(v) => set("recipient_name", v)} />
        <TextField label="Receiver phone" value={form.recipient_phone ?? ""} keyboardType="phone-pad" onChangeText={(v) => set("recipient_phone", v)} />

        <Typography variant="label">Save as</Typography>
        <View style={styles.chips}>
          {LABELS.map((l) => {
            const active = form.label === l.value;
            return (
              <Pressable key={l.value} onPress={() => set("label", l.value)} style={[styles.chip, active && styles.chipActive]}>
                <Typography variant="label" style={{ color: active ? colors.textOnPrimary : colors.text }}>{l.title}</Typography>
              </Pressable>
            );
          })}
        </View>

        <Pressable onPress={() => set("is_default", !form.is_default)} style={styles.checkbox}>
          <View style={[styles.box, form.is_default && styles.boxActive]} />
          <Typography>Make this my default address</Typography>
        </Pressable>
      </View>

      {error ? <Typography variant="label" tone="danger" style={{ marginTop: spacing.md }}>{error}</Typography> : null}

      <Button title={id ? "Save changes" : "Save and deliver here"} variant="accent" size="lg" fullWidth loading={save.isPending} onPress={submit} style={{ marginTop: spacing.xl }} />
      {id ? <Button title="Delete address" variant="ghost" fullWidth loading={remove.isPending} onPress={() => remove.mutate()} style={{ marginTop: spacing.sm }} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  fields: { gap: spacing.md },
  inline: { flexDirection: "row", gap: spacing.md },
  chips: { flexDirection: "row", gap: spacing.sm },
  chip: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkbox: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm },
  box: { width: 20, height: 20, borderRadius: radius.xs, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  boxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
});
