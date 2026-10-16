import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { COLORS } from "../styles/theme";

export default function QuantityStepper({
  quantity,
  onMinus,
  onPlus,
}) {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.button}
        onPress={onMinus}
      >
        <Text style={styles.buttonText}>−</Text>
      </TouchableOpacity>

      <Text style={styles.quantity}>
        {quantity}
      </Text>

      <TouchableOpacity
        style={styles.button}
        onPress={onPlus}
      >
        <Text style={styles.buttonText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
  },

  button: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  buttonText: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: "700",
  },

  quantity: {
    width: 34,
    textAlign: "center",
    color: COLORS.primary,
    fontWeight: "700",
  },
});