import React from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "../i18n";

import { colors, fonts, radius, shadow } from "../theme/colors";
import { money } from "../utils/format";

/*
 * A rider's delivery activity: deliveries completed and the value of the
 * orders delivered today, in the last 7 days and overall.
 * This is activity, not pay: the app does not calculate rider earnings.
 */
export default function RiderActivity({ summary }) {
  if (!summary) return null;
  const cols = [
    ["Today", summary.today],
    ["Last 7 Days", summary.last7Days],
    ["All Time", summary.allTime],
  ];
  return (
    <View style={styles.box}>
      <Text style={styles.title}>Delivery Activity</Text>
      <View style={styles.row}>
        {cols.map(([label, v], i) => (
          <View key={label} style={[styles.col, i > 0 && styles.divider]}>
            <Text style={styles.num}>{v.deliveries}</Text>
            <Text style={styles.label}>{v.deliveries === 1 ? "Delivery" : "Deliveries"}</Text>
            <Text style={styles.value}>{money(v.orderValuePaise)}</Text>
            <Text style={styles.period}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: "#fff", borderRadius: radius.lg, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: colors.canLine, ...shadow.card },
  title: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.primaryDark, marginBottom: 10 },
  row: { flexDirection: "row" },
  col: { flex: 1, alignItems: "center", paddingHorizontal: 4 },
  divider: { borderLeftWidth: 1, borderLeftColor: colors.canLine },
  num: { fontFamily: fonts.displayBold, fontSize: 24, color: colors.primaryDark, lineHeight: 30 },
  label: { fontFamily: fonts.body, fontSize: 11, color: colors.inkSoft },
  value: { fontFamily: fonts.bodySemi, fontSize: 12.5, color: colors.ink, marginTop: 6 },
  period: { fontFamily: fonts.bodySemi, fontSize: 10.5, color: colors.primary, marginTop: 2 },
});
