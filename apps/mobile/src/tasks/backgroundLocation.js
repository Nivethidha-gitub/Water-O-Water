import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";

import api, { loadServerUrl } from "../api/client";

/*
 * Live location for riders who are out for delivery, even with the screen off or the app in the background.
 *
 * - Needs a development or production build (EAS). Expo Go on Android cannot run background location;
 *   there startBackgroundTracking() returns "foreground" and the app keeps tracking while it is open.
 * - Needs the rider to allow location "all the time". If they only allow "while using", tracking
 *   continues only while the app is open.
 * - Runs only while a delivery is out for delivery; RiderHome stops it afterwards and on sign-out.
 */
export const LOCATION_TASK = "wow-rider-location";

// Must be defined at import time (App.js imports this file) so the OS can start it headlessly.
TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
  if (error || !data || !data.locations || !data.locations.length) return;
  const last = data.locations[data.locations.length - 1];
  try {
    await loadServerUrl(); // the app may have been restarted in the background
    await api.post("/rider/location", {
      latitude: last.coords.latitude,
      longitude: last.coords.longitude,
      accuracy: last.coords.accuracy,
      speed: last.coords.speed,
      heading: last.coords.heading,
    });
  } catch (_) {
    // A missed update is fine: the next one arrives within seconds.
  }
});

/** Returns "background" | "foreground" (only while the app is open) | "denied". */
export async function startBackgroundTracking() {
  try {
    const foreground = await Location.requestForegroundPermissionsAsync();
    if (foreground.status !== "granted") return "denied";
    const background = await Location.requestBackgroundPermissionsAsync();
    if (background.status !== "granted") return "foreground";
    if (!(await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK))) {
      await Location.startLocationUpdatesAsync(LOCATION_TASK, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 8000,
        distanceInterval: 20,
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: "Delivery in progress",
          notificationBody: "Sharing your live location with the customer.",
          notificationColor: "#0B5C7A",
        },
      });
    }
    return "background";
  } catch (_) {
    return "foreground"; // e.g. Expo Go: fall back to tracking while the app is open
  }
}

export async function stopBackgroundTracking() {
  try {
    if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  } catch (_) {
    // nothing to stop
  }
}
