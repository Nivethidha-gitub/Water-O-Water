
import React from "react";

import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";

import ProductCard from "../components/ProductCard";

import {
  COLORS,
  SPACING,
  RADIUS,
} from "../styles/theme";

export default function HomeScreen({
  quantities,
  changeQuantity,
  setScreen,
  data,
  products = [],
}) {
  // Backend customer data
  const customer = data?.customer || {};
  const address = data?.address || {};
  const orders = data?.orders || [];

  // Get customer name safely
  const customerName =
    customer.name ||
    customer.fullName ||
    customer.customerName ||
    "Ayesha R.";

  // Get address safely
  const addressText =
    address.line ||
    address.address ||
    address.addressLine ||
    address.location ||
    "Anna Nagar, Chennai";

  // Latest order from backend
  const latestOrder =
    orders.length > 0 ? orders[0] : null;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
    >
      {/* HEADER */}

      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.greeting}>
            Hi, {customerName} 👋
          </Text>

          <Text style={styles.location}>
            📍 {addressText}
          </Text>
        </View>

        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {customerName.charAt(0).toUpperCase()}
          </Text>
        </View>
      </View>

      {/* WATER STATUS */}

      <View style={styles.hero}>
        <Text style={styles.smallLabel}>
          YOUR WATER STATUS
        </Text>

        <Text style={styles.heroTitle}>
          Your water usually runs out in 2 days
        </Text>

        <Text style={styles.heroText}>
          Based on your recent orders. Reorder now
          so you're never dry.
        </Text>

        <TouchableOpacity
          style={styles.button}
          onPress={() => setScreen("order")}
        >
          <Text style={styles.buttonText}>
            Reorder now
          </Text>
        </TouchableOpacity>
      </View>

      {/* ORDER STATUS */}

      <View style={styles.statusCard}>
        <View style={styles.statusHeader}>
          <Text style={styles.statusTitle}>
            {latestOrder
              ? "Order out for delivery"
              : "No active order"}
          </Text>

          {latestOrder && (
            <View style={styles.dot} />
          )}
        </View>

        <Text style={styles.statusText}>
          {latestOrder
            ? `Arriving by ${
                latestOrder.eta || "6:30 PM"
              }`
            : "Place an order to see delivery status"}
        </Text>

        {latestOrder && (
          <TouchableOpacity
            onPress={() => setScreen("track")}
          >
            <Text style={styles.link}>
              Track order →
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* QUICK ORDER */}

      <Text style={styles.sectionTitle}>
        Quick Order
      </Text>

      {products.slice(0, 2).map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          quantity={quantities[product.id] || 0}
          onMinus={() =>
            changeQuantity(product.id, -1)
          }
          onPlus={() =>
            changeQuantity(product.id, 1)
          }
        />
      ))}
      <TouchableOpacity
  activeOpacity={0.85}
  style={styles.refillBanner}
  onPress={() => setScreen("profile")}
>
  <View style={styles.refillTextContainer}>
    <Text style={styles.refillTitle}>
      Never run out — Monthly Refill Plan
    </Text>

    <Text style={styles.refillSubtitle}>
      4 cans a month, auto-delivered · from ₹99/mo
    </Text>
  </View>

  <View style={styles.viewButton}>
    <Text style={styles.viewButtonText}>
      View
    </Text>
  </View>
</TouchableOpacity>

      {/* RECURRING */}

      <View style={styles.promo}>
        <Text style={styles.promoTitle}>
          Never run out 💧
        </Text>

        <Text style={styles.promoText}>
          Set a daily, weekly or custom delivery
          schedule.
        </Text>

        <TouchableOpacity
          onPress={() => setScreen("order")}
        >
          <Text style={styles.link}>
            Create schedule →
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },

  content: {
    padding: SPACING.md,
    paddingBottom: 30,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },

  headerText: {
    flex: 1,
    paddingRight: 10,
  },

  greeting: {
    color: COLORS.primary,
    fontSize: 22,
    fontWeight: "700",
  },

  location: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 5,
  },

  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: COLORS.secondary,
    alignItems: "center",
    justifyContent: "center",
  },

  avatarText: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: "700",
  },

  hero: {
    backgroundColor: COLORS.lightBlue,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },

  smallLabel: {
    color: COLORS.secondary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
  },

  heroTitle: {
    color: COLORS.primary,
    fontSize: 20,
    fontWeight: "700",
    marginTop: 8,
    lineHeight: 27,
  },

  heroText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 15,
  },

  button: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    alignItems: "center",
  },

  buttonText: {
    color: COLORS.white,
    fontWeight: "700",
  },

  statusCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: 18,
    marginBottom: 22,
  },

  statusHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  statusTitle: {
    color: COLORS.primary,
    fontWeight: "700",
    fontSize: 16,
  },

  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.success,
  },

  statusText: {
    color: COLORS.textSecondary,
    marginTop: 8,
  },

  link: {
    color: COLORS.secondary,
    fontWeight: "700",
    marginTop: 12,
  },

  sectionTitle: {
    color: COLORS.primary,
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 10,
  },

  promo: {
    backgroundColor: COLORS.lightGreen,
    borderRadius: RADIUS.lg,
    padding: 18,
    marginTop: 12,
  },

  promoTitle: {
    color: COLORS.primary,
    fontSize: 17,
    fontWeight: "700",
  },

  promoText: {
    color: COLORS.textSecondary,
    marginTop: 5,
  },
  refillBanner: {
  backgroundColor: "#0B3B4F",
  borderRadius: 22,
  padding: 20,
  marginTop: 16,
  marginBottom: 4,
  flexDirection: "row",
  alignItems: "center",
},

refillTextContainer: {
  flex: 1,
  paddingRight: 14,
},

refillTitle: {
  color: COLORS.white,
  fontSize: 18,
  fontWeight: "700",
  lineHeight: 24,
},

refillSubtitle: {
  color: "rgba(255, 255, 255, 0.8)",
  fontSize: 14,
  lineHeight: 20,
  marginTop: 7,
},

viewButton: {
  backgroundColor: COLORS.white,
  borderRadius: 999,
  paddingVertical: 12,
  paddingHorizontal: 24,
  alignItems: "center",
  justifyContent: "center",
},

viewButtonText: {
  color: "#0B3B4F",
  fontSize: 14,
  fontWeight: "700",
},
});

