import React from "react";
import {
  View,
  Text,
  StyleSheet,
} from "react-native";

import { COLORS } from "../styles/theme";

export default function StatusTimeline() {
  const steps = [
    {
      title: "Order confirmed",
      time: "2:14 PM",
      status: "done",
    },
    {
      title: "Cans filled & packed",
      time: "2:40 PM",
      status: "done",
    },
    {
      title: "Out for delivery",
      time: "Arriving by 6:30 PM",
      status: "current",
    },
    {
      title: "Delivered",
      time: "",
      status: "upcoming",
    },
  ];

  return (
    <View style={styles.container}>
      {steps.map((step) => (
        <View
          key={step.title}
          style={styles.row}
        >
          <View
            style={[
              styles.circle,

              step.status === "done" &&
                styles.done,

              step.status === "current" &&
                styles.current,
            ]}
          >
            <Text style={styles.circleText}>
              {step.status === "done"
                ? "✓"
                : step.status === "current"
                ? "•"
                : ""}
            </Text>
          </View>

          <View>
            <Text style={styles.title}>
              {step.title}
            </Text>

            {step.time ? (
              <Text style={styles.time}>
                {step.time}
              </Text>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 18,
  },

  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 18,
  },

  circle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#D8E2E6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  done: {
    backgroundColor: COLORS.success,
  },

  current: {
    backgroundColor: COLORS.secondary,
  },

  circleText: {
    color: COLORS.white,
    fontWeight: "700",
  },

  title: {
    color: COLORS.primary,
    fontWeight: "700",
  },

  time: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 3,
  },
});