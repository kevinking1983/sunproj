import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";

import { OrderTile } from "@/components/OrderTile";
import { Button, Screen, Typography } from "@/components/ui";
import { colors, spacing } from "@/constants/theme";
import { describeRiderError, riderApi } from "@/lib/api";
import { queryKeys } from "@/lib/query";
import { useRider } from "@/stores/rider";

export default function PoolScreen() {
  const qc = useQueryClient();
  const online = useRider((s) => s.online);
  const pool = useQuery({ queryKey: queryKeys.pool, queryFn: riderApi.pool, refetchInterval: 15_000 });
  const [error, setError] = useState<string | null>(null);
  const claim = useMutation({
    mutationFn: (id: string) => riderApi.claim(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.pool });
      void qc.invalidateQueries({ queryKey: queryKeys.active });
    },
    onError: (e) => setError(describeRiderError(e)),
  });
  return (
    <Screen padded={false}>
      <Typography variant="title" style={styles.title}>Available for pickup</Typography>
      {!online ? <Typography variant="caption" tone="muted" style={styles.hint}>Go online on the Deliveries tab to accept orders.</Typography> : null}
      {error ? <Typography variant="caption" tone="danger" style={styles.hint}>{error}</Typography> : null}
      <FlatList
        data={pool.data ?? []}
        keyExtractor={(o) => o.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        refreshControl={<RefreshControl refreshing={pool.isFetching} onRefresh={() => void pool.refetch()} tintColor={colors.primary} />}
        renderItem={({ item }) => <OrderTile order={item} action={<Button title="Accept delivery" variant="accent" fullWidth disabled={!online} loading={claim.isPending && claim.variables === item.id} onPress={() => claim.mutate(item.id)} />} />}
        ListEmptyComponent={<Typography tone="muted" center style={{ marginTop: spacing.xxl }}>Nothing waiting right now.</Typography>}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  hint: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
  list: { padding: spacing.lg, paddingBottom: 100 },
});
