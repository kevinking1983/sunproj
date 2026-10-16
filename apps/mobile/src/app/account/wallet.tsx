import { useQuery } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";

import { Screen, Typography } from "@/components/ui";
import { colors, radius, spacing } from "@/constants/theme";
import { queryKeys } from "@/lib/query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/stores/auth";
import { formatInr } from "@ration/shared";

interface WalletTx {
  id: number;
  amount: number;
  kind: string;
  note: string | null;
  created_at: string;
}

const KIND_LABEL: Record<string, string> = {
  refund: "Refund",
  referral: "Referral reward",
  cashback: "Cashback",
  order_debit: "Order payment",
  adjustment: "Adjustment",
};

export default function WalletScreen() {
  const userId = useAuth((s) => s.session?.user.id ?? "");
  const balance = useAuth((s) => s.profile?.wallet_balance ?? 0);
  const tx = useQuery({
    queryKey: queryKeys.wallet(userId),
    queryFn: async (): Promise<WalletTx[]> => {
      const { data, error } = await supabase.from("wallet_transactions").select("id, amount, kind, note, created_at").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
  });

  return (
    <Screen padded={false} edges={[]}>
      <Stack.Screen options={{ title: "Wallet" }} />
      <View style={styles.balance}>
        <Typography variant="caption" tone="onDark" style={{ opacity: 0.8 }}>AVAILABLE BALANCE</Typography>
        <Typography variant="display" tone="onDark">{formatInr(balance)}</Typography>
        <Typography variant="caption" tone="onDark" style={{ opacity: 0.8 }}>Use it at checkout by choosing RATION wallet.</Typography>
      </View>
      {tx.isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={tx.data ?? []}
          keyExtractor={(t) => String(t.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Typography variant="label" weight="medium">{KIND_LABEL[item.kind] ?? item.kind}</Typography>
                <Typography variant="caption" tone="muted">{item.note ?? ""} · {new Date(item.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</Typography>
              </View>
              <Typography variant="label" weight="bold" tone={item.amount >= 0 ? "success" : "default"}>{item.amount >= 0 ? "+" : "-"}{formatInr(Math.abs(item.amount))}</Typography>
            </View>
          )}
          ListEmptyComponent={<Typography tone="muted" center style={{ marginTop: spacing.xl }}>No wallet activity yet.</Typography>}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  balance: { margin: spacing.lg, padding: spacing.xl, borderRadius: radius.lg, backgroundColor: colors.primaryDark, gap: spacing.xs },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
});
