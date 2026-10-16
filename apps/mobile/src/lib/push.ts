import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";
import { Platform } from "react-native";

import { supabase } from "@/lib/supabase";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Asks for permission (once) and stores the Expo push token for the signed-in user.
 * Safe to call on every app start; it is a no-op on simulators and when denied.
 */
export const registerForPush = async (userId: string): Promise<void> => {
  if (!Device.isDevice) return;
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("orders", {
        name: "Order updates",
        importance: AndroidImportance.HIGH,
        sound: "default",
        lightColor: "#D9A441",
      });
    }
    const existing = await Notifications.getPermissionsAsync();
    const status = existing.granted ? existing.status : (await Notifications.requestPermissionsAsync()).status;
    if (status !== "granted") return;
    const { data: token } = await Notifications.getExpoPushTokenAsync();
    await supabase.from("push_tokens").upsert({ user_id: userId, token, platform: Platform.OS === "ios" ? "ios" : "android", updated_at: new Date().toISOString() });
  } catch (e) {
    console.warn("push registration failed", e);
  }
};
