import React from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "../i18n";

import { colors, fonts } from "../theme/colors";
import { formatTime, timeOf } from "../utils/format";

// How far along each status is. "Delivered" only appears when the server says the order is delivered,
// which only happens after the assigned rider completed it with the customer's code or a photo.
const RANK = { placed: 0, accepted: 1, preparing: 2, ready_for_pickup: 3, picked_up: 4, out_for_delivery: 5, exception: 5, delivered: 6, settled: 6 };

/*
 * Order timeline for the customer ("8. Track Order"):
 *   Order placed -> Accepted -> Preparing -> Ready for pickup -> Picked up -> Out for delivery -> Delivered.
 * Each step is derived from the order's real status (never guessed), with the time from its history.
 */
export function buildSteps(order) {
  const rank = RANK[order?.status] ?? 0;
  const reached = (n) => rank >= n;
  const rider = order?.rider?.name || order?.riderName;

  const raw = [
    {
      key: "placed",
      title: "Order Placed",
      sub: order?.supplier?.name ? `Sent to ${order.supplier.name}` : "Your order has been received",
      done: true,
      at: order?.createdAt,
    },
    {
      key: "accepted",
      title: "Accepted",
      sub: "The supplier accepted your order",
      done: reached(1),
      at: timeOf(order, "accepted"),
    },
    {
      key: "preparing",
      title: "Preparing",
      sub: "Your cans are being filled and packed",
      done: reached(2),
      at: timeOf(order, "preparing"),
    },
    {
      key: "ready",
      title: "Ready for Pickup",
      sub: rider ? `${rider} will collect your order` : "Waiting for a delivery partner to collect it",
      done: reached(3),
      at: timeOf(order, "ready_for_pickup"),
    },
    {
      key: "picked",
      title: "Picked Up",
      sub: rider ? `${rider} has your order` : "The rider has collected your order",
      done: reached(4),
      at: timeOf(order, "picked_up"),
    },
    {
      key: "out",
      title: "Out for Delivery",
      sub: "Your delivery is on the way",
      done: reached(5),
      at: timeOf(order, "out_for_delivery"),
    },
    {
      key: "delivered",
      title: "Delivered",
      sub: reached(6) ? "Enjoy Your Fresh Water" : "Confirmed by the rider with your delivery code",
      done: reached(6),
      at: timeOf(order, "delivered"),
    },
  ];

  const firstPending = raw.findIndex((s) => !s.done);
  return raw.map((s, i) => ({
    ...s,
    state: s.done ? (i === raw.length - 1 || !raw[i + 1].done ? "current" : "done") : i === firstPending ? "next" : "pending",
  }));
}

export default function Timeline({ steps }) {
  return (
    <View>
      {steps.map((step, i) => {
        const last = i === steps.length - 1;
        const done = step.state === "done" || step.state === "current";
        const lineDone = step.state === "done";
        return (
          <View key={step.key} style={styles.row}>
            <View style={styles.rail}>
              <View
                style={[
                  styles.dot,
                  done && styles.dotDone,
                  step.state === "current" && styles.dotCurrent,
                  step.state === "next" && styles.dotNext,
                ]}
              >
                {done ? <Text style={styles.check}>✓</Text> : null}
              </View>
              {!last ? <View style={[styles.line, lineDone && styles.lineDone]} /> : null}
            </View>
            <View style={[styles.body, last && { paddingBottom: 0 }]}>
              <View style={styles.titleRow}>
                <Text style={[styles.title, !done && styles.titlePending]}>{step.title}</Text>
                {step.at && done ? <Text style={styles.time}>{formatTime(step.at)}</Text> : null}
              </View>
              <Text style={styles.sub}>{step.sub}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row" },
  rail: { width: 30, alignItems: "center" },
  dot: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: "#E1ECF0",
    alignItems: "center", justifyContent: "center",
  },
  dotDone: { backgroundColor: colors.good },
  dotCurrent: { shadowColor: colors.good, shadowOpacity: 0.45, shadowRadius: 6, shadowOffset: { width: 0, height: 0 }, elevation: 3 },
  dotNext: { backgroundColor: "#fff", borderWidth: 2, borderColor: colors.accent },
  check: { color: "#fff", fontSize: 13, fontFamily: fonts.bodyBold },
  line: { flex: 1, width: 2, backgroundColor: "#E1ECF0", marginVertical: 2 },
  lineDone: { backgroundColor: colors.good },
  body: { flex: 1, paddingLeft: 10, paddingBottom: 22 },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  title: { fontFamily: fonts.bodyBold, fontSize: 14.5, color: colors.ink, flexShrink: 1 },
  titlePending: { color: colors.inkFaint },
  time: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.inkSoft },
  sub: { fontFamily: fonts.body, fontSize: 12.5, color: colors.inkSoft, marginTop: 2 },
});
