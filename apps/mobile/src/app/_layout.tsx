import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { colors } from "@/constants/theme";
import { registerForPush } from "@/lib/push";
import { queryClient } from "@/lib/query";
import { useAuth } from "@/stores/auth";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const status = useAuth((s) => s.status);
  const userId = useAuth((s) => s.session?.user.id);
  const initialise = useAuth((s) => s.initialise);

  useEffect(() => initialise(), [initialise]);

  useEffect(() => {
    if (userId) void registerForPush(userId);
  }, [userId]);

  useEffect(() => {
    if (status !== "loading") SplashScreen.hideAsync();
  }, [status]);

  if (status === "loading") return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Protected guard={status === "signed_in"}>
            <Stack.Screen name="(tabs)" />
          </Stack.Protected>
          <Stack.Protected guard={status === "signed_out"}>
            <Stack.Screen name="(auth)" />
          </Stack.Protected>
        </Stack>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
