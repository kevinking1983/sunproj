/**
 * Live location publishing. While the partner is online, positions go to rider_locations
 * every few seconds: a foreground watcher while the app is open, and a background task
 * (expo-task-manager) so customers keep seeing the rider when the phone is in a pocket.
 */
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";

import { trackingApi } from "@/lib/api";

export const LOCATION_TASK = "ration-rider-location";

TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
  if (error || !data) return;
  const { locations } = data as { locations: Location.LocationObject[] };
  const last = locations[locations.length - 1];
  if (!last) return;
  try {
    await trackingApi.publishPosition(last.coords.latitude, last.coords.longitude, last.coords.heading ?? null);
  } catch {
    // Offline or signed out: the next fix will retry.
  }
});

let foregroundSub: Location.LocationSubscription | null = null;

export const requestLocationPermissions = async (): Promise<{ foreground: boolean; background: boolean }> => {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== "granted") return { foreground: false, background: false };
  const bg = await Location.requestBackgroundPermissionsAsync().catch(() => ({ status: "denied" as const }));
  return { foreground: true, background: bg.status === "granted" };
};

export const currentPosition = async (): Promise<{ lat: number; lng: number } | null> => {
  const last = await Location.getLastKnownPositionAsync({ maxAge: 30_000 });
  const pos = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }).catch(() => null));
  return pos ? { lat: pos.coords.latitude, lng: pos.coords.longitude } : null;
};

export const startPublishing = async (onPosition?: (p: { lat: number; lng: number }) => void): Promise<void> => {
  const perms = await requestLocationPermissions();
  if (!perms.foreground) throw new Error("LOCATION_PERMISSION");
  if (!foregroundSub) {
    foregroundSub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 5_000, distanceInterval: 15 }, (loc) => {
      onPosition?.({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      void trackingApi.publishPosition(loc.coords.latitude, loc.coords.longitude, loc.coords.heading ?? null).catch(() => undefined);
    });
  }
  if (perms.background) {
    const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
    if (!running) {
      await Location.startLocationUpdatesAsync(LOCATION_TASK, {
        accuracy: Location.Accuracy.High,
        timeInterval: 10_000,
        distanceInterval: 25,
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
        foregroundService: { notificationTitle: "RATION Partner is online", notificationBody: "Sharing your location with customers while you deliver.", notificationColor: "#20543B" },
      });
    }
  }
};

export const stopPublishing = async (): Promise<void> => {
  foregroundSub?.remove();
  foregroundSub = null;
  const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
  if (running) await Location.stopLocationUpdatesAsync(LOCATION_TASK);
};
