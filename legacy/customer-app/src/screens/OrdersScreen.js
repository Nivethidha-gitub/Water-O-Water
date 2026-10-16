
import React from "react";

import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";

import StatusTimeline from "../components/StatusTimeline";

import {
  COLORS,
} from "../styles/theme";

export default function OrdersScreen({
  setScreen,
  data,
}) {
  const orders = data?.orders || [];

  function getStatusLabel(status) {
    if (!status) {
      return "Placed";
    }

    switch (status) {
      case "placed":
        return "Placed";

      case "accepted":
        return "Accepted";

      case "preparing":
        return "Preparing";

      case "ready":
        return "Ready";

      case "out_for_delivery":
        return "Out for delivery";

      case "delivered":
        return "Delivered";

      case "cancelled":
        return "Cancelled";

      default:
        return status;
    }
  }

  function isActiveOrder(status) {
    return status !== "delivered" &&
      status !== "cancelled";
  }

  function formatDate(dateValue) {
    if (!dateValue) {
      return "Recent order";
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return "Recent order";
    }

    return date.toLocaleDateString(
      "en-IN",
      {
        day: "numeric",
        month: "short",
        year: "numeric",
      }
    );
  }

  function getTotal(order) {
    if (order?.totalPaise != null) {
      return order.totalPaise / 100;
    }

    return 0;
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.title}>
        Orders
      </Text>

      <Text style={styles.subtitle}>
        Your recent water orders
      </Text>

      {orders.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>
            💧
          </Text>

          <Text style={styles.emptyTitle}>
            No orders yet
          </Text>

          <Text style={styles.emptyText}>
            Place your first water order to see
            it here.
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
      ) : (
        orders.map((order) => {
          const active =
            isActiveOrder(order.status);

          return (
            <View
              key={order.id}
              style={styles.card}
            >
              <View style={styles.header}>
                <View style={styles.headerLeft}>
                  <Text style={styles.orderCode}>
                    Order #{order.code || order.id}
                  </Text>

                  <Text style={styles.orderDate}>
                    {formatDate(order.createdAt)}
                  </Text>
                </View>

                <Text
                  style={[
                    styles.status,
                    active
                      ? styles.active
                      : styles.delivered,
                  ]}
                >
                  {getStatusLabel(
                    order.status
                  )}
                </Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.row}>
                <Text style={styles.label}>
                  Product
                </Text>

                <Text style={styles.value}>
                  {order.productId === "can20"
                    ? "20L Can"
                    : order.productId || "Water"}
                </Text>
              </View>

              <View style={styles.row}>
                <Text style={styles.label}>
                  Quantity
                </Text>

                <Text style={styles.value}>
                  {order.qty || 1}
                </Text>
              </View>

              <View style={styles.row}>
                <Text style={styles.label}>
                  Total
                </Text>

                <Text style={styles.price}>
                  ₹{getTotal(order)}
                </Text>
              </View>

              {order.eta && (
                <View style={styles.etaBox}>
                  <Text style={styles.etaLabel}>
                    EXPECTED DELIVERY
                  </Text>

                  <Text style={styles.eta}>
                    {order.eta}
                  </Text>
                </View>
              )}

              {active && (
                <TouchableOpacity
                  style={styles.trackButton}
                  onPress={() => {
                    setScreen("track");
                  }}
                >
                  <Text style={styles.trackButtonText}>
                    Track Order →
                  </Text>
                </TouchableOpacity>
              )}

              {order.status === "delivered" && (
                <Text style={styles.deliveredText}>
                  ✓ Delivery completed
                </Text>
              )}

              {active && (
                <View style={styles.timeline}>
                  <StatusTimeline />
                </View>
              )}
            </View>
          );
        })
      )}

      <TouchableOpacity
        style={styles.newOrderButton}
        onPress={() =>
          setScreen("order")
        }
      >
        <Text style={styles.newOrderText}>
          + Place New Order
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
    padding: 16,
    paddingBottom: 40,
  },

  title: {
    color: COLORS.primary,
    fontSize: 24,
    fontWeight: "700",
  },

  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 5,
    marginBottom: 18,
  },

  card: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 18,
    marginBottom: 15,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  headerLeft: {
    flex: 1,
    paddingRight: 10,
  },

  orderCode: {
    color: COLORS.primary,
    fontWeight: "700",
    fontSize: 15,
  },

  orderDate: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 4,
  },

  status: {
    fontWeight: "700",
    fontSize: 13,
  },

  active: {
    color: COLORS.secondary,
  },

  delivered: {
    color: COLORS.success,
  },

  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 14,
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },

  label: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },

  value: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "600",
  },

  price: {
    color: COLORS.secondary,
    fontSize: 16,
    fontWeight: "700",
  },

  etaBox: {
    backgroundColor: COLORS.lightBlue,
    borderRadius: 12,
    padding: 13,
    marginTop: 15,
  },

  etaLabel: {
    color: COLORS.secondary,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },

  eta: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: "700",
    marginTop: 5,
  },

  trackButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 15,
  },

  trackButtonText: {
    color: COLORS.white,
    fontWeight: "700",
    fontSize: 14,
  },

  timeline: {
    marginTop: 15,
  },

  deliveredText: {
    color: COLORS.success,
    fontWeight: "600",
    fontSize: 13,
    marginTop: 15,
  },

  emptyCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 25,
    alignItems: "center",
    marginTop: 10,
  },

  emptyIcon: {
    fontSize: 42,
  },

  emptyTitle: {
    color: COLORS.primary,
    fontSize: 18,
    fontWeight: "700",
    marginTop: 12,
  },

  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
    marginTop: 6,
  },

  orderButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 25,
    marginTop: 18,
  },

  orderButtonText: {
    color: COLORS.white,
    fontWeight: "700",
  },

  newOrderButton: {
    borderWidth: 1,
    borderColor: COLORS.secondary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 5,
  },

  newOrderText: {
    color: COLORS.secondary,
    fontWeight: "700",
    fontSize: 14,
  },
});

