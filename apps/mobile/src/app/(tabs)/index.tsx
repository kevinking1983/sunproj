import { router } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DeliveryHeader } from "@/components/home/DeliveryHeader";
import { Button, Typography } from "@/components/ui";
import { colors, radius, spacing } from "@/constants/theme";
import { useLocation } from "@/stores/location";

export default function HomeScreen() {
  const status = useLocation((s) => s.status);
  const store = useLocation((s) => s.store);
  const refreshStore = useLocation((s) => s.refreshStore);

  // First launch after login: ask for a delivery location before showing the catalog.
  useEffect(() => {
    if (status === "idle") router.push("/location");
    else void refreshStore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <DeliveryHeader />
      <View style={styles.body}>
        {status === "unserviceable" ? (
          <View style={styles.notice}>
            <Typography variant="heading">We are not here yet</Typography>
            <Typography tone="muted" center>
              RATION does not deliver to this location right now. Pick another address to keep shopping.
            </Typography>
            <Button title="Change location" variant="primary" onPress={() => router.push("/location")} />
          </View>
        ) : (
          <View style={styles.notice}>
            <Typography variant="heading">{store ? `Shopping from ${store.name}` : "Choose a location"}</Typography>
            <Typography tone="muted" center>Catalog, search and cart are the next build step.</Typography>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.primaryDark },
  body: {
    flex: 1,
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
  },
  notice: { marginTop: spacing.xxxl, alignItems: "center", gap: spacing.md },
});
