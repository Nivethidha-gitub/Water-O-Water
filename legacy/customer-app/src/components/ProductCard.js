import React from "react";
import { View, Text, StyleSheet } from "react-native";

import QuantityStepper from "./QuantityStepper";

import {
  COLORS,
  RADIUS,
  SPACING,
} from "../styles/theme";

export default function ProductCard({
  product,
  quantity,
  onMinus,
  onPlus,
}) {
  return (
    <View style={styles.card}>
      <View style={styles.info}>
        <Text style={styles.name}>
          {product.name}
        </Text>

        <Text style={styles.description}>
          {product.description}
        </Text>

        <Text style={styles.price}>
          ₹{product.price}
        </Text>
      </View>

      <QuantityStepper
        quantity={quantity}
        onMinus={onMinus}
        onPlus={onPlus}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  info: {
    flex: 1,
  },

  name: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: "700",
  },

  description: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 3,
  },

  price: {
    color: COLORS.secondary,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 5,
  },
});