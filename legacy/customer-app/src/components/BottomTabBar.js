import React from "react";

import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";

import {
  COLORS,
} from "../styles/theme";

export default function BottomTabBar({
  screen,
  setScreen,
}) {
  const tabs = [
    {
      id: "home",
      label: "Home",
      icon: "⌂",
    },
    {
      id: "order",
      label: "Order",
      icon: "🛒",
    },
    {
      id: "track",
      label: "Track",
      icon: "📍",
    },
    {
      id: "profile",
      label: "Profile",
      icon: "👤",
    },
  ];

  return (
    <View style={styles.container}>
      {tabs.map((tab) => {
        const active =
          screen === tab.id;

        return (
          <TouchableOpacity
            key={tab.id}
            style={styles.tab}
            onPress={() =>
              setScreen(tab.id)
            }
          >
            <Text
              style={[
                styles.icon,
                active &&
                  styles.activeIcon,
              ]}
            >
              {tab.icon}
            </Text>

            <Text
              style={[
                styles.label,
                active &&
                  styles.activeLabel,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingVertical: 8,
    paddingBottom: 10,
  },

  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  icon: {
    fontSize: 20,
    color: COLORS.textSecondary,
  },

  activeIcon: {
    color: COLORS.secondary,
  },

  label: {
    fontSize: 11,
    marginTop: 3,
    color: COLORS.textSecondary,
    fontWeight: "600",
  },

  activeLabel: {
    color: COLORS.secondary,
    fontWeight: "700",
  },
});