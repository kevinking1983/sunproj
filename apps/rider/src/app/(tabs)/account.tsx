import { useQuery } from "@tanstack/react-query";
import { Alert, StyleSheet, View } from "react-native";

import { Button, Screen, Typography } from "@/components/ui";
import { colors, radius, spacing } from "@/constants/theme";
import { riderApi } from "@/lib/api";
import { formatIndianMobile } from "@/lib/phone";
import { queryKeys } from "@/lib/query";
import { useAuth } from "@/stores/auth";
import { useRider } from "@/stores/rider";
import { formatInr } from "@ration/shared";

export default function AccountScreen() {
  const profile = useAuth((s) => s.profile);
  const signOut = useAuth((s) => s.signOut);
  const setOnline = useRider((s) => s.setOnline);
  const summary = useQuery({ queryKey: queryKeys.summary, queryFn: riderApi.summary });
  return (
    <Screen>
      <Typography variant="title">{profile?.full_name ?? "Delivery partner"}</Typography>
      <Typography tone="muted">{profile?.phone ? formatIndianMobile(profile.phone) : ""}</Typography>
      <View style={styles.card}>
        <Typography variant="caption" tone="muted">LIFETIME DELIVERIES</Typography>
        <Typography variant="display">{summary.data?.delivered_total ?? 0}</Typography>
        <Typography variant="caption" tone="muted">Cash collected today: {formatInr(summary.data?.cod_collected_today ?? 0)} · deposit at the store at end of shift</Typography>
      </View>
      <Typography variant="caption" tone="muted" style={{ marginTop: spacing.lg }}>Payouts are settled weekly to your registered bank account by the store.</Typography>
      <Button title="Log out" variant="secondary" style={{ marginTop: spacing.xl }} onPress={() => Alert.alert("Log out?", "You will go offline.", [{ text: "Cancel", style: "cancel" }, { text: "Log out", style: "destructive", onPress: () => void setOnline(false).finally(() => signOut()) }])} />
    </Screen>
  );
}

const styles = StyleSheet.create({ card: { marginTop: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.xs } });
