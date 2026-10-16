import React, { useState } from "react";

import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  StyleSheet,
} from "react-native";

import {
  COLORS,
  SPACING,
  RADIUS,
} from "../styles/theme";

export default function ProfileScreen({
  data,
  setScreen,
}) {
  const [pickupEnabled, setPickupEnabled] =
    useState(true);

  const customer =
    data?.customer || {};

  const address =
    data?.address || {};

  const orders =
    data?.orders || [];

  const customerName =
    customer.name ||
    customer.fullName ||
    "Ayesha R.";

  const homeAddress =
    address.line ||
    address.address ||
    "Anna Nagar";

  const orderCount =
    orders.length || 18;

  return (
    <View style={styles.container}>
      {/* HEADER */}

      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          Profile
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={
          styles.content
        }
        showsVerticalScrollIndicator={false}
      >
        {/* CUSTOMER */}

        <Text style={styles.greeting}>
          {customerName}
        </Text>

        {/* PLAN CARD */}

        <View style={styles.planCard}>
          <Text style={styles.planTitle}>
            Monthly Refill Plan
          </Text>

          <Text style={styles.planSubtitle}>
            4 cans/month · next billing 3 Sep
          </Text>

          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.manageButton}
            onPress={() =>
              setScreen &&
              setScreen("profile")
            }
          >
            <Text
              style={styles.manageButtonText}
            >
              Manage plan · ₹99/mo
            </Text>
          </TouchableOpacity>
        </View>

        {/* SETTINGS */}

        <View style={styles.settings}>
          {/* HOME */}

          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.row}
          >
            <View style={styles.iconTile}>
              <Text style={styles.icon}>
                🏠
              </Text>
            </View>

            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>
                Home — {homeAddress}
              </Text>

              <Text style={styles.rowSubtitle}>
                Default delivery address
              </Text>
            </View>

            <Text style={styles.arrow}>
              ›
            </Text>
          </TouchableOpacity>

          {/* OFFICE */}

          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.row}
          >
            <View style={styles.iconTile}>
              <Text style={styles.icon}>
                🏢
              </Text>
            </View>

            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>
                Office — Guindy
              </Text>

              <Text style={styles.rowSubtitle}>
                Add for office orders
              </Text>
            </View>

            <Text style={styles.arrow}>
              ›
            </Text>
          </TouchableOpacity>

          {/* EMPTY CAN PICKUP */}

          <View style={styles.row}>
            <View style={styles.iconTile}>
              <Text style={styles.icon}>
                ♻️
              </Text>
            </View>

            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>
                Empty can pickup
              </Text>

              <Text style={styles.rowSubtitle}>
                Notify supplier automatically
              </Text>
            </View>

            <Switch
              value={pickupEnabled}
              onValueChange={
                setPickupEnabled
              }
              trackColor={{
                false: "#D6E2E7",
                true: COLORS.success,
              }}
              thumbColor={
                COLORS.white
              }
            />
          </View>

          {/* ORDER HISTORY */}

          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.row}
            onPress={() =>
              setScreen &&
              setScreen("orders")
            }
          >
            <View style={styles.iconTile}>
              <Text style={styles.icon}>
                🧾
              </Text>
            </View>

            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>
                Order history
              </Text>

              <Text style={styles.rowSubtitle}>
                {orderCount} orders since Feb 2026
              </Text>
            </View>

            <Text style={styles.arrow}>
              ›
            </Text>
          </TouchableOpacity>

          {/* PAYMENTS */}

          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.row}
          >
            <View style={styles.iconTile}>
              <Text style={styles.icon}>
                💳
              </Text>
            </View>

            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>
                Payments
              </Text>

              <Text style={styles.rowSubtitle}>
                UPI · Cash on delivery
              </Text>
            </View>

            <Text style={styles.arrow}>
              ›
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor:
      "#F2F7FA",
  },

  header: {
    backgroundColor:
      COLORS.white,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor:
      COLORS.border,
  },

  headerTitle: {
    color: COLORS.primary,
    fontSize: 22,
    fontWeight: "700",
  },

  scroll: {
    flex: 1,
  },

  content: {
    paddingTop: 16,
    paddingBottom: 30,
  },

  greeting: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: "600",
    marginHorizontal: 20,
    marginBottom: 10,
  },

  planCard: {
    marginHorizontal: 20,
    backgroundColor:
      "#0B3B4F",
    borderRadius: 24,
    padding: 20,
    marginBottom: 18,

    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
  },

  planTitle: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: "700",
  },

  planSubtitle: {
    color:
      "rgba(255,255,255,0.8)",
    fontSize: 14,
    marginTop: 7,
  },

  manageButton: {
    alignSelf: "flex-start",
    backgroundColor:
      COLORS.white,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 18,
    marginTop: 16,
  },

  manageButtonText: {
    color: "#0B3B4F",
    fontSize: 13,
    fontWeight: "700",
  },

  settings: {
    marginHorizontal: 20,
  },

  row: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor:
      COLORS.border,
    paddingVertical: 10,
  },

  iconTile: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor:
      "#E3F3F8",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 13,
  },

  icon: {
    fontSize: 20,
  },

  rowText: {
    flex: 1,
  },

  rowTitle: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "700",
  },

  rowSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },

  arrow: {
    color: COLORS.textSecondary,
    fontSize: 25,
    marginLeft: 8,
  },
});