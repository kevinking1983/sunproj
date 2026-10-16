import { Stack } from "expo-router";

import { colors } from "@/constants/theme";

export default function LocationLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        presentation: "modal",
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
