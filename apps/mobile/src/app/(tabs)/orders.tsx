import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from "react-native";

import { CartBar } from "@/components/cart/CartBar";
import { OrderCard } from "@/components/orders/OrderCard";
import { Button, Screen, Typography } from "@/components/ui";
import { colors, spacing } from "@/constants/theme";
import { ordersApi } from "@/lib/api/orders";
import { queryKeys } from "@/lib/query";
import { useAuth } from "@/stores/auth";

export default function OrdersScreen() {
  const userId = useAuth((s) => s.session?.user.id ?? "");
  const orders = useQuery({ queryKey: queryKeys.orders(userId), queryFn: ordersApi.list, enabled: !!userId });

  return (
    <Screen padded={false}>
      <Typography variant="title" style={styles.title}>Your orders</Typography>
      {orders.isLoading ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <FlatList
          data={orders.data ?? []}
          keyExtractor={(o) => o.id}
          renderItem={({ item }) => <OrderCard order={item} />}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          refreshControl={<RefreshControl refreshing={orders.isFetching} onRefresh={() => { void orders.refetch(); }} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="receipt-outline" size={56} color={colors.primaryLight} />
              <Typography variant="heading">No orders yet</Typography>
              <Typography tone="muted" center>Your orders and their live status will show up here.</Typography>
              <Button title="Start shopping" onPress={() => router.push("/(tabs)")} />
            </View>
          }
        />
      )}
      <CartBar />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  list: { padding: spacing.lg, paddingBottom: 120 },
  empty: { alignItems: "center", gap: spacing.md, marginTop: spacing.xxxl, padding: spacing.lg },
});
