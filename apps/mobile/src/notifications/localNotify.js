import { LogBox, Platform } from "react-native";

/*
 * System notifications (the status-bar icon + heads-up banner, like any other app).
 *
 * Works in Expo Go as LOCAL notifications: when the app hears about an update over its live
 * connection it asks the phone to show a notification. (Remote push to a closed app needs a
 * development build — see NOTIFICATIONS_SETUP.md.) Everything is wrapped so the app keeps
 * working if the module or the permission is unavailable.
 */
// Expo Go on Android (SDK 53+) logs a one-off notice that REMOTE push was removed from Expo Go. This app does
// not use remote push (it uses local notifications driven by its live connection), so the notice is harmless.
LogBox.ignoreLogs(["expo-notifications: Android Push notifications"]);
let Notifications = null;
try { Notifications = require("expo-notifications"); } catch (e) { Notifications = null; }

const CHANNEL = "wow-updates";
let ready = null;

export function setupNotifications() {
  if (!Notifications) return Promise.resolve(false);
  if (ready) return ready;
  ready = (async () => {
    try {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false,
        }),
      });
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync(CHANNEL, {
          name: "Order & delivery updates",
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 200, 120, 200],
          lightColor: "#0B5C7A",
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        });
      }
      let { status } = await Notifications.getPermissionsAsync();
      if (status !== "granted") ({ status } = await Notifications.requestPermissionsAsync());
      return status === "granted";
    } catch (e) {
      return false;
    }
  })();
  return ready;
}

/** true / false once the person has answered the permission prompt; null if it cannot be checked. */
export async function notificationsAllowed() {
  if (!Notifications) return null;
  try { return (await Notifications.getPermissionsAsync()).status === "granted"; } catch (e) { return null; }
}

/** Shows a system notification now. Resolves true if it was handed to the phone. */
export async function notify(title, body, data = {}) {
  if (!Notifications) return false;
  try {
    if (!(await setupNotifications())) return false;
    await Notifications.scheduleNotificationAsync({
      content: { title, body: body || undefined, data, color: "#0B5C7A", sound: "default" },
      trigger: Platform.OS === "android" ? { channelId: CHANNEL } : null,
    });
    return true;
  } catch (e) {
    return false;
  }
}

/** Calls fn(data) when the person taps a notification (app open, in background, or launched by it). */
export function onNotificationTap(fn) {
  if (!Notifications) return () => {};
  const handle = (response) => {
    const data = response && response.notification && response.notification.request.content.data;
    fn(data || {});
  };
  const sub = Notifications.addNotificationResponseReceivedListener(handle);
  Notifications.getLastNotificationResponseAsync().then((r) => { if (r) handle(r); }).catch(() => {});
  return () => sub.remove();
}
