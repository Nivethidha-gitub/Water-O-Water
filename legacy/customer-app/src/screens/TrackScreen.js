
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
  RADIUS,
  SPACING,
} from "../styles/theme";

export default function TrackScreen({
  setScreen,
  data,
  confirmedOrder,
}) {
  const orders = data?.orders || [];

  /*
   * Use the newly created order first.
   * Otherwise use the latest backend order.
   */
  const order =
    confirmedOrder ||
    orders[0] ||
    null;

  const orderCode =
    order?.code ||
    order?.id ||
    "No order";

  const quantity =
    order?.qty || 0;

  const status =
    order?.status || "placed";

  const eta =
    order?.eta ||
    "Today, 4–7 PM";

  const supplier =
    order?.fulfillingSupplierId ||
    order?.primarySupplierId ||
    "Supplier";

  function getStatusText() {
    switch (status) {
      case "placed":
        return "Order placed";

      case "accepted":
        return "Order accepted";

      case "preparing":
        return "Preparing your order";

      case "ready":
        return "Order ready";

      case "out_for_delivery":
        return "Out for delivery";

      case "delivered":
        return "Delivered";

      case "cancelled":
        return "Order cancelled";

      default:
        return "Order placed";
    }
  }

  function isCompleted(step) {
    const statusOrder = [
      "placed",
      "accepted",
      "preparing",
      "ready",
      "out_for_delivery",
      "delivered",
    ];

    const currentIndex =
      statusOrder.indexOf(status);

    const stepIndex =
      statusOrder.indexOf(step);

    if (currentIndex === -1) {
      return step === "placed";
    }

    return stepIndex <= currentIndex;
  }

  if (!order) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>
          💧
        </Text>

        <Text style={styles.emptyTitle}>
          No active order
        </Text>

        <Text style={styles.emptyText}>
          Place an order to see its delivery
          status here.
        </Text>

        <TouchableOpacity
          style={styles.orderButton}
          onPress={() =>
            setScreen("order")
          }
        >
          <Text style={styles.orderButtonText}>
            Order Water
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={
        styles.content
      }
    >
      <Text style={styles.title}>
        Track Order
      </Text>

      <Text style={styles.subtitle}>
        Order #{orderCode}
      </Text>

      <View style={styles.etaCard}>
        <Text style={styles.etaLabel}>
          EXPECTED DELIVERY
        </Text>

        <Text style={styles.eta}>
          {eta}
        </Text>

        <Text style={styles.etaStatus}>
          {getStatusText()}
        </Text>
      </View>

      <View style={styles.orderCard}>
        <View style={styles.orderHeader}>
          <View>
            <Text style={styles.orderLabel}>
              ORDER NUMBER
            </Text>

            <Text style={styles.orderCode}>
              #{orderCode}
            </Text>
          </View>

          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>
              {status}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>
            Product
          </Text>

          <Text style={styles.infoValue}>
            {order.productId === "can20"
              ? "20L Can"
              : order.productId || "Water"}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>
            Quantity
          </Text>

          <Text style={styles.infoValue}>
            {quantity}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>
            Supplier
          </Text>

          <Text style={styles.infoValue}>
            {supplier}
          </Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>
        Delivery status
      </Text>

      <View style={styles.timelineCard}>
        <TimelineItem
          title="Order placed"
          text="Your order has been received."
          active={isCompleted("placed")}
          last={false}
        />

        <TimelineItem
          title="Supplier confirmation"
          text="Supplier will accept and prepare your order."
          active={isCompleted("accepted")}
          last={false}
        />

        <TimelineItem
          title="Preparing"
          text="Your water order is being prepared."
          active={isCompleted("preparing")}
          last={false}
        />

        <TimelineItem
          title="Out for delivery"
          text="Your delivery partner will bring your order."
          active={isCompleted("out_for_delivery")}
          last={false}
        />

        <TimelineItem
          title="Delivered"
          text="Your water has been delivered."
          active={isCompleted("delivered")}
          last={true}
        />
      </View>

      <TouchableOpacity
        style={styles.ordersButton}
        onPress={() =>
          setScreen("orders")
        }
      >
        <Text style={styles.ordersButtonText}>
          View All Orders
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.homeButton}
        onPress={() =>
          setScreen("home")
        }
      >
        <Text style={styles.homeButtonText}>
          Back to Home
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function TimelineItem({
  title,
  text,
  active,
  last,
}) {
  return (
    <View style={styles.timelineItem}>
      <View style={styles.timelineLeft}>
        <View
          style={[
            styles.circle,
            active &&
              styles.activeCircle,
          ]}
        >
          {active && (
            <Text style={styles.check}>
              ✓
            </Text>
          )}
        </View>

        {!last && (
          <View
            style={[
              styles.line,
              active &&
                styles.activeLine,
            ]}
          />
        )}
      </View>

      <View style={styles.timelineContent}>
        <Text
          style={[
            styles.timelineTitle,
            active &&
              styles.activeTimelineTitle,
          ]}
        >
          {title}
        </Text>

        <Text style={styles.timelineText}>
          {text}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },

  content: {
    padding: SPACING.md,
    paddingBottom: 40,
  },

  title: {
    color: COLORS.primary,
    fontSize: 25,
    fontWeight: "700",
  },

  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 5,
    marginBottom: 18,
  },

  etaCard: {
    backgroundColor: COLORS.lightBlue,
    borderRadius: RADIUS.xl,
    padding: 20,
    marginBottom: 15,
  },

  etaLabel: {
    color: COLORS.secondary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
  },

  eta: {
    color: COLORS.primary,
    fontSize: 23,
    fontWeight: "700",
    marginTop: 7,
  },

  etaStatus: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 6,
  },

  orderCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: 18,
  },

  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  orderLabel: {
    color: COLORS.muted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },

  orderCode: {
    color: COLORS.primary,
    fontSize: 20,
    fontWeight: "700",
    marginTop: 5,
  },

  statusBadge: {
    backgroundColor: COLORS.lightGreen,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  statusBadgeText: {
    color: COLORS.success,
    fontSize: 11,
    fontWeight: "700",
  },

  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 15,
  },

  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },

  infoLabel: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },

  infoValue: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "600",
  },

  sectionTitle: {
    color: COLORS.primary,
    fontSize: 17,
    fontWeight: "700",
    marginTop: 22,
    marginBottom: 10,
  },

  timelineCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: 18,
  },

  timelineItem: {
    flexDirection: "row",
    minHeight: 72,
  },

  timelineLeft: {
    width: 32,
    alignItems: "center",
  },

  circle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.white,
  },

  activeCircle: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },

  check: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: "700",
  },

  line: {
    width: 2,
    flex: 1,
    backgroundColor: COLORS.border,
    marginVertical: 3,
  },

  activeLine: {
    backgroundColor: COLORS.primary,
  },

  timelineContent: {
    flex: 1,
    paddingLeft: 10,
    paddingBottom: 15,
  },

  timelineTitle: {
    color: COLORS.muted,
    fontSize: 14,
    fontWeight: "600",
  },

  activeTimelineTitle: {
    color: COLORS.primary,
    fontWeight: "700",
  },

  timelineText: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 3,
  },

  ordersButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 18,
  },

  ordersButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: "700",
  },

  homeButton: {
    alignItems: "center",
    paddingVertical: 15,
  },

  homeButtonText: {
    color: COLORS.muted,
    fontSize: 14,
    fontWeight: "600",
  },

  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
  },

  emptyIcon: {
    fontSize: 45,
  },

  emptyTitle: {
    color: COLORS.primary,
    fontSize: 20,
    fontWeight: "700",
    marginTop: 12,
  },

  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    textAlign: "center",
    marginTop: 7,
    lineHeight: 20,
  },

  orderButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 25,
    paddingVertical: 13,
    marginTop: 20,
  },

  orderButtonText: {
    color: COLORS.white,
    fontWeight: "700",
  },
});

