import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, Modal, Pressable, StyleSheet, Text as RNText, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import Icon from "./Icon";
import { registerDialogHost } from "../utils/alert";
import { colors, fonts, radius, shadow } from "../theme/colors";

/*
 * App-wide pop-up box. Every Alert.alert() in the app opens this:
 * a light-blue card, a round icon badge, dark-blue title and text, and theme buttons.
 *  - cancel      -> soft outlined button
 *  - destructive -> deep-blue filled button (the choice that changes something)
 *  - default     -> ocean-blue gradient button
 * Two buttons sit side by side, three or more stack. Calls queue, so none is lost.
 */
const pickIcon = (buttons) => {
  if (buttons.some((b) => b.style === "destructive")) return "alert-circle";
  if (buttons.length > 1) return "help-circle";
  return "check"; // single-button notice (e.g. "Delivered"): green tick
};

const TONES = {
  success: { halo: "#E1F1E9", ring: "#BFDDD0", core: "#2A7A62" },
  theme: { halo: "#D3EBF3", ring: "#A9D3E1", core: colors.primary },
};

export function DialogHost() {
  const [queue, setQueue] = useState([]);
  const current = queue[0];
  const fade = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(0)).current;

  useEffect(() => registerDialogHost((d) => setQueue((q) => [...q, d])), []);

  useEffect(() => {
    if (!current) return;
    fade.setValue(0);
    lift.setValue(0);
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(lift, { toValue: 1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [current]);

  const close = useCallback((button) => {
    setQueue((q) => q.slice(1));
    if (button && button.onPress) setTimeout(() => button.onPress(), 0);
  }, []);

  if (!current) return null;
  const { title, message, buttons } = current;
  const cancel = buttons.find((b) => b.style === "cancel");
  const stacked = buttons.length > 2;
  // Single-button notices (e.g. "Delivered") get the green success circles; questions and confirmations stay theme blue.
  const tone = buttons.length === 1 ? TONES.success : TONES.theme;

  const renderButton = (b, i) => {
    const isCancel = b.style === "cancel";
    const isDanger = b.style === "destructive";
    const label = <RNText style={[styles.btnText, { color: isCancel ? colors.primaryDark : "#fff" }]}>{b.text}</RNText>;
    const common = ({ pressed }) => [styles.btn, !stacked && { flex: 1 }, pressed && { opacity: 0.85 }];
    if (isCancel) {
      return (
        <Pressable key={i} onPress={() => close(b)} style={(s) => [common(s), styles.btnCancel]} accessibilityRole="button">
          {label}
        </Pressable>
      );
    }
    if (isDanger) {
      return (
        <Pressable key={i} onPress={() => close(b)} style={(s) => [common(s), { backgroundColor: colors.primaryDark }]} accessibilityRole="button">
          {label}
        </Pressable>
      );
    }
    return (
      <Pressable key={i} onPress={() => close(b)} style={(s) => [common(s), { overflow: "hidden" }]} accessibilityRole="button">
        <LinearGradient colors={[colors.primary, colors.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        {label}
      </Pressable>
    );
  };

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={() => close(cancel)}>
      <Animated.View style={[styles.scrim, { opacity: fade }]}>
        <Animated.View
          style={[
            styles.card,
            { opacity: fade, transform: [{ translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }, { scale: lift.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] },
          ]}
          accessibilityViewIsModal
        >
          {/* Same layered circles as the Delivered page: halo, thin ring, solid centre */}
          <View style={[styles.halo, { backgroundColor: tone.halo }]}>
            <View style={[styles.ring, { borderColor: tone.ring }]}>
              <View style={[styles.core, { backgroundColor: tone.core }]}><Icon name={pickIcon(buttons)} size={26} color="#fff" /></View>
            </View>
          </View>
          <RNText style={styles.title} accessibilityRole="header">{title}</RNText>
          {message ? <RNText style={styles.message}>{message}</RNText> : null}
          <View style={[styles.actions, stacked && { flexDirection: "column" }]}>{buttons.map(renderButton)}</View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: colors.popupScrim, alignItems: "center", justifyContent: "center", padding: 28 },
  card: {
    width: "100%", maxWidth: 360, backgroundColor: colors.popup, borderRadius: 26,
    paddingHorizontal: 22, paddingTop: 24, paddingBottom: 20, alignItems: "center",
    borderWidth: 1, borderColor: colors.popupLine, ...shadow.lift,
  },
  halo: { width: 104, height: 104, borderRadius: 52, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  ring: { width: 82, height: 82, borderRadius: 41, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  core: { width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: fonts.displayBold, fontSize: 19, color: colors.primaryDark, textAlign: "center" },
  message: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.ink, opacity: 0.85, textAlign: "center", marginTop: 8 },
  actions: { flexDirection: "row", gap: 10, alignSelf: "stretch", marginTop: 22 },
  btn: { minHeight: 46, borderRadius: radius.md + 2, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
  btnCancel: { backgroundColor: "#D3EBF3", borderWidth: 1, borderColor: colors.popupLine },
  btnText: { fontFamily: fonts.bodyBold, fontSize: 14 },
});
