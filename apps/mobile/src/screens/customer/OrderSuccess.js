import React from "react";
import Icon from "../../components/Icon";
import { StyleSheet, View } from "react-native";
import { LanguageToggle, Text } from "../../i18n";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "../../components/ui";
import { colors, fonts, radius, shadow } from "../../theme/colors";
import { itemsSummary, money } from "../../utils/format";

/**
 * Customer order confirmation.
 * Deliberately uses the same blue design language as the rest of the app.
 */
export default function OrderSuccess({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const order = route.params?.order || {};

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 18 }]}>
      <StatusBar style="dark" />

      <View style={styles.topBar}>
        <LanguageToggle tone="light" />
      </View>

      <View style={styles.content}>
        <View style={styles.iconRing}>
          <View style={styles.check}><Text style={styles.checkText}>✓</Text></View>
        </View>

        <Text style={styles.title}>Confirmed!</Text>
        <Text style={styles.sub}>
          Your order has been confirmed and sent to {order.supplier?.name || "your supplier"}.
        </Text>

        <View style={styles.card}>
          <View style={styles.cardTop}>
            <View>
              <Text style={styles.cardLabel}>Order Number</Text>
              <Text style={styles.code}>#{order.code || order.id}</Text>
            </View>
            <View style={styles.orderMark}><Icon name="package" size={20} /></View>
          </View>

          <View style={styles.rule} />

          <View style={styles.row}>
            <Text style={styles.label}>Items</Text>
            <Text style={styles.value} numberOfLines={2}>{itemsSummary(order)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Supplier</Text>
            <Text style={styles.value}>{order.supplier?.name || "—"}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Total</Text>
            <Text style={styles.total}>{money(order.totalPaise)}</Text>
          </View>

          {order.eta ? (
            <View style={styles.eta}>
              <Text style={styles.etaLabel}>Estimated Delivery</Text>
              <Text style={styles.etaValue}>{order.eta}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View>
        <Button title="Track My Order" onPress={() => navigation.replace("TrackOrder", { orderId: order.id })} />
        <Button title="Back to Home" variant="outline" onPress={() => navigation.popToTop()} style={{ marginTop: 10 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 20 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 2 },
  brand: { fontFamily: fonts.displayBold, fontSize: 17, color: colors.primaryDark },
  step: { fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 1, color: colors.primary },
  content: { flex: 1, justifyContent: "center", alignItems: "center" },
  iconRing: {
    width: 104, height: 104, borderRadius: 52, backgroundColor: colors.can,
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.canLine,
  },
  check: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: colors.good,
    alignItems: "center", justifyContent: "center", ...shadow.lift,
  },
  checkText: { color: "#fff", fontFamily: fonts.bodyBold, fontSize: 38, lineHeight: 43 },
  title: { fontFamily: fonts.displayBold, fontSize: 25, color: colors.ink, textAlign: "center", marginTop: 20 },
  sub: { fontFamily: fonts.body, fontSize: 13.5, color: colors.inkSoft, textAlign: "center", lineHeight: 20, marginTop: 7, maxWidth: 330 },
  card: {
    alignSelf: "stretch", backgroundColor: colors.surface, borderRadius: radius.xl,
    padding: 18, marginTop: 24, borderWidth: 1, borderColor: "#E1ECF4", ...shadow.card,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardLabel: { fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 0.8, color: colors.inkSoft },
  code: { fontFamily: fonts.displayBold, fontSize: 20, color: colors.primaryDark, marginTop: 2 },
  orderMark: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.can, alignItems: "center", justifyContent: "center" },
  orderMarkText: { fontSize: 21 },
  rule: { height: 1, backgroundColor: "#EAF0F5", marginVertical: 14 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 14, paddingVertical: 6 },
  label: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft },
  value: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 13, color: colors.ink, textAlign: "right" },
  total: { fontFamily: fonts.displayBold, fontSize: 16, color: colors.primaryDark },
  eta: { marginTop: 10, backgroundColor: colors.can, borderRadius: radius.md, padding: 12, borderWidth: 1, borderColor: colors.canLine },
  etaLabel: { fontFamily: fonts.bodyBold, fontSize: 9.5, letterSpacing: 0.7, color: colors.primary },
  etaValue: { fontFamily: fonts.displayBold, fontSize: 15, color: colors.primaryDark, marginTop: 2 },
});
