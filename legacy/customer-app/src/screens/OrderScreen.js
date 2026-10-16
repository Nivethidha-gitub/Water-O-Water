
import React, { useState } from "react";

import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";

import ProductCard from "../components/ProductCard";

import {
  COLORS,
  SPACING,
  RADIUS,
} from "../styles/theme";

import { createOrder } from "../api";

export default function OrderScreen({
  quantities,
  changeQuantity,
  setScreen,
  data,
  setConfirmedOrder,
  products = [],
}) {
  const [orderType, setOrderType] =
    useState("one-time");

  const [frequency, setFrequency] =
    useState("weekly");

  const [selectedDays, setSelectedDays] =
    useState([2, 5]);

  const [placingOrder, setPlacingOrder] =
    useState(false);

  const days = [
    { id: 1, name: "Mon" },
    { id: 2, name: "Tue" },
    { id: 3, name: "Wed" },
    { id: 4, name: "Thu" },
    { id: 5, name: "Fri" },
    { id: 6, name: "Sat" },
    { id: 7, name: "Sun" },
  ];

  const frequencies = [
    {
      id: "daily",
      label: "Daily",
    },
    {
      id: "weekly",
      label: "Weekly",
    },
    {
      id: "weekdays",
      label: "Weekdays",
    },
    {
      id: "weekends",
      label: "Weekends",
    },
    {
      id: "2-days",
      label: "2 days/week",
    },
    {
      id: "3-days",
      label: "3 days/week",
    },
    {
      id: "custom",
      label: "Custom",
    },
  ];

  function selectFrequency(id) {
    setFrequency(id);

    if (id === "daily") {
      setSelectedDays([
        1,
        2,
        3,
        4,
        5,
        6,
        7,
      ]);
    } else if (id === "weekly") {
      setSelectedDays([2]);
    } else if (id === "weekdays") {
      setSelectedDays([
        1,
        2,
        3,
        4,
        5,
      ]);
    } else if (id === "weekends") {
      setSelectedDays([6, 7]);
    } else if (id === "2-days") {
      setSelectedDays([2, 5]);
    } else if (id === "3-days") {
      setSelectedDays([2, 4, 6]);
    } else if (id === "custom") {
      setSelectedDays([]);
    }
  }

  function toggleDay(dayId) {
    if (selectedDays.includes(dayId)) {
      setSelectedDays(
        selectedDays.filter(
          (day) => day !== dayId
        )
      );
    } else {
      setSelectedDays(
        [...selectedDays, dayId].sort(
          (a, b) => a - b
        )
      );
    }

    setFrequency("custom");
  }

  const totalItems = products.reduce(
    (total, product) => {
      return (
        total +
        (quantities[product.id] || 0)
      );
    },
    0
  );

  const totalPrice = products.reduce(
    (total, product) => {
      return (
        total +
        (quantities[product.id] || 0) *
          Number(product.price || 0)
      );
    },
    0
  );

  function getScheduleText() {
    if (orderType === "one-time") {
      return "One-time delivery";
    }

    if (frequency === "daily") {
      return "Every day";
    }

    if (frequency === "weekly") {
      return "Every week";
    }

    if (frequency === "weekdays") {
      return "Monday to Friday";
    }

    if (frequency === "weekends") {
      return "Saturday and Sunday";
    }

    if (frequency === "2-days") {
      return "2 days every week";
    }

    if (frequency === "3-days") {
      return "3 days every week";
    }

    return (
      String(selectedDays.length) +
      " custom days"
    );
  }

  async function confirmOrder() {
    if (totalItems === 0) {
      Alert.alert(
        "Add products",
        "Please select at least one product."
      );
      return;
    }

    if (
      orderType === "recurring" &&
      selectedDays.length === 0
    ) {
      Alert.alert(
        "Select days",
        "Please select at least one delivery day."
      );
      return;
    }

    if (placingOrder) {
      return;
    }

    try {
      setPlacingOrder(true);

      const customerId =
        data?.customer?.id ||
        "cust-ayesha";

      const householdId =
        data?.customer?.householdId ||
        data?.customer?.household_id ||
        "hh-ayesha";

    const selectedItems = products
  .filter(
    (product) =>
      (quantities[product.id] || 0) > 0
  )
  .map((product) => ({
    productId: product.id,
    qty: quantities[product.id],
  }));

     if (selectedItems.length === 0) {
  Alert.alert(
    "Add products",
    "Please select at least one product."
  );

  setPlacingOrder(false);
  return;
}

      const orderData = {
        customerId: customerId,

        householdId: householdId,

        items: selectedItems,

        primarySupplierId:
          data?.suppliers?.[0]?.id ||
          "sup-murugan",

        orderType: orderType,

        frequency:
          orderType === "recurring"
            ? frequency
            : null,

        deliveryDays:
          orderType === "recurring"
            ? selectedDays
            : [],

        source: "web",

        actorType: "customer",
      };

      console.log(
        "Creating order:",
        orderData
      );

      const createdOrder =
        await createOrder(orderData);

      console.log(
        "Order created:",
        createdOrder
      );

      if (setConfirmedOrder) {
        setConfirmedOrder(
          createdOrder
        );
      }

      setScreen("confirmed");
    } catch (error) {
      console.log(
        "Create order error:",
        error
      );

      Alert.alert(
        "Order failed",
        error.message ||
          "Could not place your order. Please try again."
      );
    } finally {
      setPlacingOrder(false);
    }
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={
        styles.content
      }
    >
      <Text style={styles.title}>
        Order Water
      </Text>

      <Text style={styles.subtitle}>
        Choose your water products
      </Text>

      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          quantity={
            quantities[product.id] || 0
          }
          onMinus={() =>
            changeQuantity(
              product.id,
              -1
            )
          }
          onPlus={() =>
            changeQuantity(
              product.id,
              1
            )
          }
        />
      ))}

      <Text style={styles.sectionTitle}>
        Delivery type
      </Text>

      <View style={styles.typeContainer}>
        <TouchableOpacity
          style={[
            styles.typeButton,
            orderType === "one-time" &&
              styles.selectedType,
          ]}
          onPress={() =>
            setOrderType("one-time")
          }
        >
          <Text
            style={[
              styles.typeText,
              orderType === "one-time" &&
                styles.selectedText,
            ]}
          >
            One-time
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.typeButton,
            orderType === "recurring" &&
              styles.selectedType,
          ]}
          onPress={() =>
            setOrderType("recurring")
          }
        >
          <Text
            style={[
              styles.typeText,
              orderType === "recurring" &&
                styles.selectedText,
            ]}
          >
            Recurring
          </Text>
        </TouchableOpacity>
      </View>

      {orderType === "recurring" && (
        <>
          <Text style={styles.sectionTitle}>
            Delivery frequency
          </Text>

          <View
            style={
              styles.frequencyContainer
            }
          >
            {frequencies.map((item) => {
              const selected =
                frequency === item.id;

              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.frequencyButton,
                    selected &&
                      styles.selectedFrequency,
                  ]}
                  onPress={() =>
                    selectFrequency(
                      item.id
                    )
                  }
                >
                  <Text
                    style={[
                      styles.frequencyText,
                      selected &&
                        styles.selectedFrequencyText,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.sectionTitle}>
            Select delivery days
          </Text>

          <View
            style={styles.daysContainer}
          >
            {days.map((day) => {
              const selected =
                selectedDays.includes(
                  day.id
                );

              return (
                <TouchableOpacity
                  key={day.id}
                  style={[
                    styles.dayButton,
                    selected &&
                      styles.selectedDay,
                  ]}
                  onPress={() =>
                    toggleDay(day.id)
                  }
                >
                  <Text
                    style={[
                      styles.dayText,
                      selected &&
                        styles.selectedDayText,
                    ]}
                  >
                    {day.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}

      <View style={styles.summary}>
        <Text
          style={styles.summaryTitle}
        >
          Order summary
        </Text>

        <View style={styles.summaryRow}>
          <Text
            style={styles.summaryLabel}
          >
            Items
          </Text>

          <Text
            style={styles.summaryValue}
          >
            {totalItems}
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <Text
            style={styles.summaryLabel}
          >
            Delivery
          </Text>

          <Text
            style={styles.summaryValue}
          >
            {getScheduleText()}
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.summaryRow}>
          <Text
            style={styles.totalLabel}
          >
            Total
          </Text>

          <Text
            style={styles.totalValue}
          >
            ₹{totalPrice}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={[
          styles.confirmButton,
          placingOrder &&
            styles.disabledButton,
        ]}
        onPress={confirmOrder}
        disabled={placingOrder}
      >
        {placingOrder ? (
          <ActivityIndicator
            color={COLORS.white}
          />
        ) : (
          <Text
            style={styles.confirmText}
          >
            Confirm Order
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
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
    marginTop: 5,
    marginBottom: 18,
  },

  sectionTitle: {
    color: COLORS.primary,
    fontSize: 17,
    fontWeight: "700",
    marginTop: 18,
    marginBottom: 10,
  },

  typeContainer: {
    flexDirection: "row",
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: 4,
  },

  typeButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 9,
  },

  selectedType: {
    backgroundColor: COLORS.primary,
  },

  typeText: {
    color: COLORS.primary,
    fontWeight: "600",
  },

  selectedText: {
    color: COLORS.white,
  },

  frequencyContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  frequencyButton: {
    backgroundColor: COLORS.white,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  selectedFrequency: {
    backgroundColor: COLORS.lightBlue,
    borderColor: COLORS.secondary,
  },

  frequencyText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },

  selectedFrequencyText: {
    color: COLORS.secondary,
  },

  daysContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  dayButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  selectedDay: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },

  dayText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: "700",
  },

  selectedDayText: {
    color: COLORS.white,
  },

  summary: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: 18,
    marginTop: 22,
  },

  summaryTitle: {
    color: COLORS.primary,
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 12,
  },

  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },

  summaryLabel: {
    color: COLORS.textSecondary,
  },

  summaryValue: {
    color: COLORS.primary,
    fontWeight: "600",
  },

  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 12,
  },

  totalLabel: {
    color: COLORS.primary,
    fontSize: 17,
    fontWeight: "700",
  },

  totalValue: {
    color: COLORS.secondary,
    fontSize: 18,
    fontWeight: "700",
  },

  confirmButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 15,
    minHeight: 50,
    justifyContent: "center",
  },

  disabledButton: {
    opacity: 0.7,
  },

  confirmText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "700",
  },
});
