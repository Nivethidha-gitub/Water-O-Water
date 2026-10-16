export const rupees = (paise) => {
  const value = Number(paise || 0) / 100;
  return "₹" + (Number.isInteger(value) ? value : value.toFixed(2));
};

export function formatDateTime(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Recent order";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function formatStatus(status) {
  const labels = {
    placed: "New",
    accepted: "Accepted",
    preparing: "Preparing",
    ready_for_pickup: "Ready for pickup",
    picked_up: "Picked up",
    out_for_delivery: "Out for delivery",
    delivered: "Delivered",
    fallback_offered: "Fallback",
    cancelled: "Cancelled",
    exception: "Delayed",
    failed: "Unfulfilled",
    settled: "Settled",
  };
  return labels[status] || String(status || "").replaceAll("_", " ");
}

export function itemsSummary(order) {
  if (order.items?.length) return order.items.map((i) => `${i.qty} × ${i.name}`).join(", ");
  return `${order.qty} × item`;
}

import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

export const isNativeApp = () => Capacitor.isNativePlatform();

let notificationId = 1;

/** Asks for permission once the user is signed in (Android 13+/iOS). */
export async function setupNotifications() {
  try {
    if (isNativeApp()) {
      const state = await LocalNotifications.checkPermissions();
      if (state.display !== "granted") await LocalNotifications.requestPermissions();
    } else if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
  } catch {
    /* optional */
  }
}

/** System notification: native in the app, browser notification on the web. */
export function notifyDesktop(title, body) {
  try {
    if (isNativeApp()) {
      LocalNotifications.schedule({
        notifications: [{ id: notificationId++ % 2147483000, title, body: body || "" }],
      });
    } else if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.hidden) {
      new Notification(title, { body });
    }
  } catch {
    /* not supported */
  }
}
