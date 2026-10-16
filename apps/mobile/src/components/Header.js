import React from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { LanguageToggle, Text } from "../i18n";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Alert } from "../utils/alert";
import { useAuth } from "../context/AuthContext";
import { useRealtime } from "../realtime/RealtimeContext";
import { colors, fonts, radius } from "../theme/colors";

export function useSignOut() {
  const { logout } = useAuth();
  return () => Alert.alert("Sign Out?", "You will need to sign in again to continue.", [
    { text: "Cancel", style: "cancel" },
    { text: "Sign Out", style: "destructive", onPress: () => logout() },
  ]);
}

export default function Header({ title, subtitle, onBack, variant, signOut = true }) {
  const insets = useSafeAreaInsets();
  const confirmSignOut = useSignOut();
  const { connected } = useRealtime();
  const brand = (variant || (onBack ? "plain" : "brand")) === "brand";

  if (brand) {
    return (
      <View style={[styles.brand, { paddingTop: insets.top + 10 }]}>
        <View style={styles.brandLeft}>
          <View style={styles.logoWrap}>
            <Image source={require("../../assets/brand-mark-white.png")} style={styles.logo} resizeMode="contain" />
          </View>
          <View>
            <Text style={styles.wow}>Water'O'Water</Text>
            <Text style={styles.wowSub}>{subtitle || "Pure Water • Healthy Life"}</Text>
          </View>
        </View>
        <View style={styles.right}>
          <View style={styles.live}>
            <View style={[styles.liveDot, { backgroundColor: connected ? "#45C8E8" : "#8EC7E3" }]} />
            <Text style={styles.liveText}>{connected ? "Live" : "Offline"}</Text>
          </View>
          <LanguageToggle />
          {signOut ? (
            <Pressable onPress={confirmSignOut} style={styles.signOut} hitSlop={8}>
              <Text style={styles.signOutText}>Sign Out</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.plain, { paddingTop: insets.top + 6 }]}>
      <Pressable onPress={onBack} style={styles.back} hitSlop={10}><Text style={styles.backText}>‹</Text></Pressable>
      <View style={{ flex: 1 }}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  brand: { backgroundColor: colors.primaryDark, paddingHorizontal: 16, paddingBottom: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brandLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  logoWrap: { width: 42, height: 42, borderRadius: 12, backgroundColor: "rgba(255,255,255,.12)", alignItems: "center", justifyContent: "center" },
  logo: { width: 26, height: 30 },
  wow: { fontFamily: fonts.displayBold, fontSize: 16.5, color: "#fff" },
  wowSub: { fontFamily: fonts.body, fontSize: 10.5, color: colors.onDarkSoft, marginTop: 1 },
  right: { flexDirection: "row", alignItems: "center", gap: 8 },
  live: { flexDirection: "row", alignItems: "center", gap: 4 },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  liveText: { fontFamily: fonts.bodyBold, fontSize: 9.5, color: colors.onDarkSoft, letterSpacing: 0.5 },
  signOut: { backgroundColor: "rgba(255,255,255,.13)", borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: "rgba(255,255,255,.2)" },
  signOutText: { fontFamily: fonts.bodySemi, fontSize: 10.5, color: "#fff" },
  plain: { backgroundColor: "#fff", paddingHorizontal: 10, paddingBottom: 10, flexDirection: "row", alignItems: "center", gap: 4, borderBottomWidth: 1, borderBottomColor: "#E1ECF2" },
  back: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  backText: { fontSize: 31, lineHeight: 34, color: colors.primaryDark },
  title: { fontFamily: fonts.displayBold, fontSize: 18, color: colors.ink },
  sub: { fontFamily: fonts.body, fontSize: 11.5, color: colors.inkSoft },
});
