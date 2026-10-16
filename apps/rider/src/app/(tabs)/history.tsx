import { useQuery } from "@tanstack/react-query";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";

import { OrderTile } from "@/components/OrderTile";
import { Screen, Typography } from "@/components/ui";
import { colors, spacing } from "@/constants/theme";
import { riderApi } from "@/lib/api";
import { queryKeys } from "@/lib/query";

export default function HistoryScreen() {
  const history = useQuery({ queryKey: queryKeys.history, queryFn: () => riderApi.history() });
  return (
    <Screen padded={false}>
      <Typography variant="title" style={styles.title}>Completed</Typography>
      <FlatList
        data={history.data ?? []}
        keyExtractor={(o) => o.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        refreshControl={<RefreshControl refreshing={history.isFetching} onRefresh={() => void history.refetch()} tintColor={colors.primary} />}
        renderItem={({ item }) => <OrderTile order={item} />}
        ListEmptyComponent={<Typography tone="muted" center style={{ marginTop: spacing.xxl }}>No completed deliveries yet.</Typography>}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({ title: { paddingHorizontal: spacing.lg, paddingTop: spacing.md }, list: { padding: spacing.lg, paddingBottom: 100 } });
