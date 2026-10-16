import React, { useEffect, useRef } from "react";
import { Animated, Easing, Image, Pressable, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LanguageToggle, Text } from "../../i18n";
import Icon from "../../components/Icon";
import { colors, fonts } from "../../theme/colors";

/*
 * First page of the app (before Sign In / Sign Up): the brand on the ocean-blue gradient.
 * The logo and name settle in, then the actions fade up from the bottom.
 */
const FEATURES = [
  ["zap", "Order in seconds"],
  ["map-pin", "Live tracking"],
  ["refresh-cw", "Empty can pickup"],
];

export default function WelcomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const brand = useRef(new Animated.Value(0)).current;
  const actions = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(brand, { toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(actions, { toValue: 1, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  const go = (mode) => navigation.navigate("Auth", { mode });
  const rise = (v, px) => ({ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [px, 0] }) }] });

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient colors={["#0B5C7A", "#073A4E"]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
      {/* soft ripple arcs rising from the bottom */}
      <View pointerEvents="none" style={[styles.arc, { width: 760, height: 760, borderRadius: 380, bottom: -470, left: "50%", marginLeft: -380 }]} />
      <View pointerEvents="none" style={[styles.arc, { width: 560, height: 560, borderRadius: 280, bottom: -380, left: "50%", marginLeft: -280 }]} />

      <LanguageToggle style={{ position: "absolute", right: 16, top: insets.top + 12 }} />

      <View style={styles.center}>
        <Animated.View style={[styles.logoTile, { opacity: brand, transform: [{ scale: brand.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] }]}>
          <Image source={require("../../../assets/brand-mark-white.png")} style={styles.logo} resizeMode="contain" accessibilityLabel="Water 'O' water logo" />
        </Animated.View>
        <Animated.View style={[{ alignItems: "center" }, rise(brand, 12)]}>
          <Text style={styles.name}>Water 'O' water</Text>
          <Text style={styles.tag}>Never run dry.</Text>
        </Animated.View>

        <Animated.View style={[styles.features, rise(actions, 10)]}>
          {FEATURES.map(([ic, label]) => (
            <View key={label} style={styles.feature}>
              <View style={styles.featureIcon}><Icon name={ic} size={18} color="#fff" /></View>
              <Text style={styles.featureText}>{label}</Text>
            </View>
          ))}
        </Animated.View>
      </View>

      <Animated.View style={[styles.bottom, { paddingBottom: insets.bottom + 18 }, rise(actions, 16)]}>
        <Pressable onPress={() => go("signup")} style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9 }]} accessibilityRole="button">
          <Text style={styles.ctaText}>Get Started</Text>
          <Icon name="arrow-right" size={18} color={colors.primaryDark} style={{ marginLeft: 8 }} />
        </Pressable>
        <Pressable onPress={() => go("signin")} hitSlop={8} style={({ pressed }) => [styles.ghost, pressed && { opacity: 0.7 }]} accessibilityRole="button">
          <Text style={styles.ghostText}>I already have an account</Text>
        </Pressable>
        <Text style={styles.footer}>Fresh water. Right at your door.</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.primary },
  arc: { position: "absolute", borderWidth: 1, borderColor: "rgba(255,255,255,0.09)" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  logoTile: { width: 116, height: 116, borderRadius: 30, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center", marginBottom: 26 },
  logo: { width: 68, height: 68 },
  name: { fontFamily: fonts.displayBold, fontSize: 31, color: "#fff", textAlign: "center" },
  tag: { fontFamily: fonts.body, fontSize: 16, color: colors.onDarkSoft, marginTop: 10, textAlign: "center" },
  features: { flexDirection: "row", gap: 10, marginTop: 38 },
  feature: { width: 96, alignItems: "center" },
  featureIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  featureText: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.onDarkSoft, marginTop: 8, textAlign: "center" },
  bottom: { paddingHorizontal: 22 },
  cta: { flexDirection: "row", alignItems: "center", justifyContent: "center", minHeight: 54, borderRadius: 16, backgroundColor: "#fff" },
  ctaText: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.primaryDark },
  ghost: { alignItems: "center", paddingVertical: 14 },
  ghostText: { fontFamily: fonts.bodySemi, fontSize: 14, color: "#fff" },
  footer: { fontFamily: fonts.body, fontSize: 12, color: colors.onDarkFaint, textAlign: "center", marginTop: 6 },
});
