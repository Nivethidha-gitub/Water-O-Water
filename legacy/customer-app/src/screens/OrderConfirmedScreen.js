
import React from "react";

import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";

import {
  COLORS,
  SPACING,
  RADIUS,
} from "../styles/theme";

export default function OrderConfirmedScreen({
  order,
  setScreen,
}) {
  const orderCode =
    order?.code ||
    order?.id ||
    "Order";

  const quantity =
    order?.qty || 1;

  const total =
    order?.totalPaise != null
      ? order.totalPaise / 100
      : 0;

  const eta =
    order?.eta ||
    "Today, 4–7 PM";

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
    >
      <View style={styles.successCircle}>
        <Text style={styles.check}>
          ✓
        </Text>
      </View>

      <Text style={styles.title}>
        Order Confirmed!
      </Text>

      <Text style={styles.subtitle}>
        Your water order has been placed
        successfully.
      </Text>

      <View style={styles.orderCard}>
        <Text style={styles.label}>
          ORDER NUMBER
        </Text>

        <Text style={styles.orderCode}>
          #{orderCode}
        </Text>

        <View style={styles.divider} />

        <View style={styles.row}>
          <Text style={styles.rowLabel}>
            Quantity
          </Text>

          <Text style={styles.rowValue}>
            {quantity} item(s)
          </Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>
            Status
          </Text>

          <Text style={styles.status}>
            Confirmed
          </Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>
            Total
          </Text>

          <Text style={styles.total}>
            ₹{total}
          </Text>
        </View>
      </View>

      <View style={styles.etaCard}>
        <Text style={styles.etaLabel}>
          EXPECTED DELIVERY
        </Text>

        <Text style={styles.eta}>
          {eta}
        </Text>

        <Text style={styles.etaText}>
          We'll keep you updated about
          your delivery.
        </Text>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>
          What happens next?
        </Text>

        <Text style={styles.infoText}>
          ✓ Your order has been received
        </Text>

        <Text style={styles.infoText}>
          ✓ Supplier will prepare your water
        </Text>

        <Text style={styles.infoText}>
          ✓ Delivery partner will bring your order
        </Text>
      </View>

      <TouchableOpacity
        style={styles.trackButton}
        onPress={() =>
          setScreen("track")
        }
      >
        <Text style={styles.trackText}>
          Track Order
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.ordersButton}
        onPress={() =>
          setScreen("orders")
        }
      >
        <Text style={styles.ordersText}>
          View All Orders
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.homeButton}
        onPress={() =>
          setScreen("home")
        }
      >
        <Text style={styles.homeText}>
          Back to Home
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },

  content: {
    padding: SPACING.lg,
    paddingBottom: 40,
    alignItems: "center",
  },

  successCircle: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor:
      COLORS.lightGreen,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },

  check: {
    color: COLORS.success,
    fontSize: 45,
    fontWeight: "700",
  },

  title: {
    color: COLORS.primary,
    fontSize: 28,
    fontWeight: "700",
    marginTop: 18,
    textAlign: "center",
  },

  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 21,
    marginTop: 7,
    marginBottom: 22,
  },

  orderCard: {
    width: "100%",
    backgroundColor:
      COLORS.white,
    borderRadius: RADIUS.lg,
    padding: 20,
  },

  label: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
  },

  orderCode: {
    color: COLORS.primary,
    fontSize: 21,
    fontWeight: "700",
    marginTop: 5,
  },

  divider: {
    height: 1,
    backgroundColor:
      COLORS.border,
    marginVertical: 16,
  },

  row: {
    flexDirection: "row",
    justifyContent:
      "space-between",
    marginTop: 10,
  },

  rowLabel: {
    color:
      COLORS.textSecondary,
    fontSize: 14,
  },

  rowValue: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "600",
  },

  status: {
    color: COLORS.success,
    fontSize: 14,
    fontWeight: "700",
  },

  total: {
    color: COLORS.secondary,
    fontSize: 17,
    fontWeight: "700",
  },

  etaCard: {
    width: "100%",
    backgroundColor:
      COLORS.lightBlue,
    borderRadius: RADIUS.lg,
    padding: 20,
    marginTop: 15,
  },

  etaLabel: {
    color: COLORS.secondary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
  },

  eta: {
    color: COLORS.primary,
    fontSize: 22,
    fontWeight: "700",
    marginTop: 6,
  },

  etaText: {
    color:
      COLORS.textSecondary,
    fontSize: 13,
    marginTop: 6,
    lineHeight: 19,
  },

  infoCard: {
    width: "100%",
    backgroundColor:
      COLORS.white,
    borderRadius: RADIUS.lg,
    padding: 20,
    marginTop: 15,
  },

  infoTitle: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },

  infoText: {
    color:
      COLORS.textSecondary,
    fontSize: 13,
    marginTop: 7,
    lineHeight: 19,
  },

  trackButton: {
    width: "100%",
    backgroundColor:
      COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 20,
  },

  trackText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: "700",
  },

  ordersButton: {
    width: "100%",
    borderWidth: 1,
    borderColor:
      COLORS.secondary,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 10,
  },

  ordersText: {
    color: COLORS.secondary,
    fontSize: 15,
    fontWeight: "700",
  },

  homeButton: {
    paddingVertical: 14,
  },

  homeText: {
    color: COLORS.muted,
    fontSize: 14,
    fontWeight: "600",
  },
});

