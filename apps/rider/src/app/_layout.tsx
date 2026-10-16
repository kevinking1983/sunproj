import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { colors } from "@/constants/theme";
import { registerForPush } from "@/lib/push";
import { queryClient } from "@/lib/query";
import { isRider, useAuth } from "@/stores/auth";

import "@/lib/location";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const status = useAuth((s) => s.status);
  const profile = useAuth((s) => s.profile);
  const userId = useAuth((s) => s.session?.user.id);
  const initialise = useAuth((s) => s.initialise);

  useEffect(() => initialise(), [initialise]);
  useEffect(() => {
    if (userId && isRider(profile)) void registerForPush(userId);
  }, [userId, profile]);
  useEffect(() => {
    if (status !== "loading") SplashScreen.hideAsync();
  }, [status]);

  if (status === "loading") return null;
  const rider = status === "signed_in" && isRider(profile);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Protected guard={rider}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="order/[id]" />
          </Stack.Protected>
          <Stack.Protected guard={status === "signed_in" && !rider}>
            <Stack.Screen name="not-partner" />
          </Stack.Protected>
          <Stack.Protected guard={status === "signed_out"}>
            <Stack.Screen name="(auth)" />
          </Stack.Protected>
        </Stack>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
