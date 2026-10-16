import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Text } from "../i18n";
import Icon from "./Icon";
import { LinearGradient } from "expo-linear-gradient";

import { colors, fonts, radius } from "../theme/colors";

/*
 * variant: "primary" (ocean-blue gradient, used for primary actions),
 *          "dark", "soft", "outline", "success", "danger"
 */
export default function Button({
  title,
  onPress,
  variant = "primary",
  busy = false,
  disabled = false,
  small = false,
  icon,
  style,
}) {
  const off = disabled || busy;
  const textColor =
    variant === "soft" || variant === "outline"
      ? colors.primaryDark
      : variant === "danger"
      ? colors.danger
      : "#fff";

  const content = (
    <View style={[styles.row, small && styles.rowSmall]}>
      {busy ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={17} color={textColor} style={styles.icon} /> : null}
          <Text style={[styles.text, small && styles.textSmall, { color: textColor }]}>{title}</Text>
        </>
      )}
    </View>
  );

  const base = [styles.base, off && styles.off, style];

  if (variant === "primary") {
    return (
      <Pressable onPress={onPress} disabled={off} style={({ pressed }) => [base, pressed && styles.pressed]}>
        <LinearGradient
          colors={[colors.primary, colors.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fill}
        >
          {content}
        </LinearGradient>
      </Pressable>
    );
  }

  const bg =
    variant === "dark"
      ? colors.primaryDark
      : variant === "success"
      ? colors.good
      : variant === "soft"
      ? colors.can
      : variant === "danger"
      ? colors.dangerBg
      : "#fff";
  const border = variant === "outline" ? { borderWidth: 1.5, borderColor: colors.canLine } : null;

  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [base, { backgroundColor: bg }, border, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.md + 2, overflow: "hidden" },
  fill: { alignItems: "center", justifyContent: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
    paddingHorizontal: 16,
    minHeight: 52,
  },
  rowSmall: { paddingVertical: 10, minHeight: 40 },
  text: { fontFamily: fonts.bodyBold, fontSize: 15 },
  textSmall: { fontSize: 13 },
  icon: { marginRight: 8 },
  off: { opacity: 0.55 },
  pressed: { opacity: 0.85 },
});
