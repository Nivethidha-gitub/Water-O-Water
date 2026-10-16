import React, { useCallback, useState } from "react";
import Icon from "../../components/Icon";
import { Pressable, StyleSheet, View } from "react-native";
import { LanguageSwitch, Text } from "../../i18n";
import { getBootstrap } from "../../api/customer";
import { useAuth } from "../../context/AuthContext";
import { useSignOut } from "../../components/Header";
import usePolling from "../../hooks/usePolling";
import { Avatar, Button, Card, Row, Screen, SectionTitle } from "../../components/ui";
import { colors, fonts, radius, shadow } from "../../theme/colors";
import { money, prettyPhone } from "../../utils/format";

export default function CustomerProfile({ navigation }) {
  const { user } = useAuth();
  const signOut = useSignOut();
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    setData(await getBootstrap());
  }, []);

  usePolling(load, 60000);

  return (
    <Screen brand subtitle="Customer">
      <View style={styles.hero}>
        <Avatar name={user?.name} size={74} />
        <View style={styles.heroText}>
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.role}>Customer Account</Text>
        </View>
      </View>

      <SectionTitle>Account Details</SectionTitle>
      <Card>
        <Row label="Delivery Address" value={data?.address?.line || "—"} />
        <Row label="Email" value={user?.email || "—"} />
        <Row label="Phone" value={user?.phone ? prettyPhone(user.phone) : "—"} />
        <Row label="Orders" value={data ? String(data.orders.length) : "—"} />
      </Card>

      <SectionTitle>History</SectionTitle>
      <View style={styles.menu}>
        {[
          ["clipboard", "Order History", data ? `${data.orders.length} orders · Receipts` : "Receipts", "History"],
          ["credit-card", "Payment History", "Cash, UPI and refunds", "History"],
        ].map(([icon, label, sub, screen], index) => (
          <Pressable key={label} style={[styles.row, index < 1 && styles.div]} onPress={() => navigation.navigate(screen)} accessibilityRole="button">
            <View style={styles.icon}><Icon name={icon} size={18} /></View>
            <View style={styles.rowContent}><Text style={styles.label}>{label}</Text><Text style={styles.sub}>{sub}</Text></View>
            <Icon name="chevron-right" size={18} color={colors.inkFaint} />
          </Pressable>
        ))}
      </View>

      <SectionTitle>Quick Settings</SectionTitle>
      <View style={styles.menu}>
        {[
          ["map-pin", "Saved Addresses", "Add, edit and choose where we deliver", "Addresses"],
          ["bell", "Notifications", "Order and rider updates", "Notifications"],
          ["help-circle", "Help & Support", "Get assistance", "Help"],
        ].map(([icon, label, sub, screen], index) => (
          <Pressable key={label} style={[styles.row, index < 2 && styles.div]} onPress={() => navigation.navigate(screen)} accessibilityRole="button">
            <View style={styles.icon}><Icon name={icon} size={18} /></View>
            <View style={styles.rowContent}><Text style={styles.label}>{label}</Text><Text style={styles.sub}>{sub}</Text></View>
            <Icon name="chevron-right" size={18} color={colors.inkFaint} />
          </Pressable>
        ))}
      </View>

      <Button title="Sign Out" variant="danger" onPress={signOut} style={styles.signOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: "center",
    backgroundColor: colors.customerBg,
    borderRadius: radius.xl,
    paddingVertical: 22,
    borderWidth: 1,
    borderColor: colors.canLine,
    ...shadow.card,
  },
  heroText: {
    alignItems: "center",
    marginTop: 10,
  },
  name: {
    fontFamily: fonts.displayBold,
    fontSize: 21,
    color: colors.primaryDark,
  },
  role: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
    marginTop: 2,
  },
  menu: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#DCE9F0",
    ...shadow.card,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    padding: 14,
  },
  div: {
    borderBottomWidth: 1,
    borderBottomColor: "#EDF2F5",
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.customerBg,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    fontSize: 19,
  },
  rowContent: {
    flex: 1,
  },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.ink,
  },
  sub: {
    fontFamily: fonts.body,
    fontSize: 10.5,
    color: colors.inkSoft,
    marginTop: 2,
  },
  chev: {
    fontSize: 22,
    color: colors.inkFaint,
  },
  historyRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#EDF2F5" },
  historyIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.customerBg, alignItems: "center", justifyContent: "center" },
  historyAmount: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.primaryDark },
  emptyHistory: { fontFamily: fonts.body, fontSize: 12, lineHeight: 18, color: colors.inkSoft, paddingVertical: 8 },
  signOut: {
    marginTop: 16,
  },
});
