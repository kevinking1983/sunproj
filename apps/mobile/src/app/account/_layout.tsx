import { Stack } from "expo-router";

import { colors } from "@/constants/theme";

export default function AccountLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: "600" },
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
