import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import type { ColorValue } from "react-native";

import { colors, fontSize, fontWeight } from "@/constants/theme";

type IconName = keyof typeof Ionicons.glyphMap;

const tab = (title: string, icon: IconName, iconActive: IconName) => ({
  title,
  tabBarIcon: ({ color, focused, size }: { color: ColorValue; focused: boolean; size: number }) => (
    <Ionicons name={focused ? iconActive : icon} color={typeof color === "string" ? color : colors.textMuted} size={size} />
  ),
});

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: fontSize.xs, fontWeight: fontWeight.medium },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" options={tab("Home", "home-outline", "home")} />
      <Tabs.Screen name="categories" options={tab("Categories", "grid-outline", "grid")} />
      <Tabs.Screen name="orders" options={tab("Orders", "receipt-outline", "receipt")} />
      <Tabs.Screen name="account" options={tab("Account", "person-outline", "person")} />
    </Tabs>
  );
}
