import { Linking } from "react-native";
import { colors } from "../theme/colors";

export const money = (paise) => {
  const value = (Number(paise) || 0) / 100;
  return "₹" + (Number.isInteger(value) ? String(value) : value.toFixed(2));
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const ap = h >= 12 ? "pm" : "am";
  h = h % 12 || 12;
  return `${h}:${m} ${ap}`;
}

export function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export const formatDateTime = (iso) => (iso ? `${formatDate(iso)}, ${formatTime(iso)}` : "");

export const isToday = (iso) => {
  if (!iso) return false;
  const d = new Date(iso);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
};

export function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

export const firstName = (name) => String(name || "").trim().split(/\s+/)[0] || "there";

export const initial = (name) => (String(name || "?").trim()[0] || "?").toUpperCase();

/** "2 × 20L Can, 1 × 1L Pack" */
export function itemsSummary(order) {
  const items = order?.items || [];
  if (!items.length) return `${order?.qty || 0} items`;
  return items.map((i) => `${i.qty} × ${i.name}`).join(", ");
}

export const totalQty = (order) =>
  (order?.items || []).reduce((sum, i) => sum + (Number(i.qty) || 0), 0) || Number(order?.qty) || 0;

// ---- order status -----------------------------------------------------------

export const STATUS = {
  placed: { label: "Placed", fg: colors.primary, bg: colors.can },
  accepted: { label: "Accepted", fg: colors.primaryDark, bg: colors.can },
  preparing: { label: "Preparing", fg: colors.primaryDark, bg: colors.can },
  ready_for_pickup: { label: "Ready for Pickup", fg: colors.primaryDark, bg: colors.can },
  picked_up: { label: "Picked Up", fg: colors.primaryDark, bg: colors.can },
  fallback_offered: { label: "Re-assigning", fg: colors.warn, bg: colors.warnBg },
  out_for_delivery: { label: "Out for Delivery", fg: colors.primaryDark, bg: colors.can },
  delivered: { label: "Delivered", fg: colors.good, bg: colors.goodBg },
  settled: { label: "Delivered", fg: colors.good, bg: colors.goodBg },
  exception: { label: "Delayed", fg: colors.warn, bg: colors.warnBg },
  cancelled: { label: "Cancelled", fg: colors.danger, bg: colors.dangerBg },
  failed: { label: "Unfulfilled", fg: colors.danger, bg: colors.dangerBg },
};

export const statusMeta = (status) =>
  STATUS[status] || { label: String(status || "").replace(/_/g, " "), fg: colors.inkSoft, bg: colors.can };

export const isDelivered = (status) => status === "delivered" || status === "settled";
// Every step between "accepted" and "delivered".
export const IN_PROGRESS = ["accepted", "preparing", "ready_for_pickup", "picked_up", "out_for_delivery"];
export const isInProgress = (status) => IN_PROGRESS.includes(status);
export const isClosed = (status) =>
  isDelivered(status) || status === "cancelled" || status === "failed";

/**
 * What the assigned rider can do next with an order (the server enforces this too).
 * { key, title, variant } or null when the rider is just waiting.
 */
export function riderNextAction(order) {
  const s = order?.status;
  const accepted = Boolean(order?.riderAcceptedAt);
  if (["accepted", "preparing", "ready_for_pickup"].includes(s) && !accepted) return { key: "accept", title: "Accept Delivery", variant: "dark" };
  if (s === "ready_for_pickup") return { key: "pickup", title: "Mark as Picked Up", variant: "dark" };
  if (s === "picked_up") return { key: "start", title: "Start Delivery", variant: "dark" };
  if (s === "out_for_delivery") return { key: "deliver", title: "Complete Delivery", variant: "success" };
  return null;
}

/** Time of the first history entry for a status, if the server sent it. */
export function timeOf(order, status) {
  const hit = (order?.history || []).find((h) => h.status === status);
  return hit ? hit.at : null;
}

// ---- phone / maps -----------------------------------------------------------

export const callPhone = (phone) => {
  if (phone) Linking.openURL(`tel:${phone}`).catch(() => {});
};

export const openMaps = (address) => {
  if (!address) return;
  Linking.openURL(
    "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(address)
  ).catch(() => {});
};

export const prettyPhone = (phone) => {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  return phone || "";
};
