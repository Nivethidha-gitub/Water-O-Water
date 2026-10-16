import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { LanguageSwitch, Text } from "../../i18n";
import Icon from "../../components/Icon";
import { useAuth } from "../../context/AuthContext";
import { useSignOut } from "../../components/Header";
import { Avatar, Button, Card, Row, Screen, SectionTitle } from "../../components/ui";
import { colors, fonts, radius, shadow } from "../../theme/colors";
import { prettyPhone } from "../../utils/format";

export default function SupplierMore({ navigation }) {
  const { user } = useAuth();
  const signOut = useSignOut();

  return (
    <Screen brand subtitle="Supplier">
      <View style={styles.hero}>
        <Avatar name={user?.supplier?.name || user?.name} size={72} tone={colors.supplierBg} />
        <Text style={styles.name}>{user?.supplier?.name || user?.name}</Text>
        <Text style={styles.role}>Supplier Account</Text>
        <View style={styles.live}>
          <View style={styles.dot} />
          <Text style={styles.liveText}>Business Online</Text>
        </View>
      </View>

      <SectionTitle>Business Details</SectionTitle>
      <Card>
        <Row label="Owner" value={user?.name || "—"} />
        <Row label="Email" value={user?.email || "—"} />
        <Row label="Phone" value={user?.phone ? prettyPhone(user.phone) : "—"} />
      </Card>

      <SectionTitle>Management</SectionTitle>
      <View style={styles.menu}>
        {[
          ["map-pin", "Service Areas", "Manage delivery coverage", () => navigation.navigate("ServiceAreas")],
          ["droplet", "Products", "Manage your water catalogue", () => navigation.navigate("Products")],
          ["truck", "Riders", "Manage delivery partners", () => navigation.navigate("Riders")],
        ].map(([icon, label, sub, onPress], index) => (
          <Pressable key={label} onPress={onPress} style={[styles.row, index < 2 && styles.div]}>
            <View style={styles.icon}>
              <Icon name={icon} size={18} />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.label}>{label}</Text>
              <Text style={styles.sub}>{sub}</Text>
            </View>
            <Text style={styles.chev}>›</Text>
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
    backgroundColor: colors.supplierBg,
    borderRadius: radius.xl,
    paddingVertical: 21,
    borderWidth: 1,
    borderColor: "#CFEBDD",
    ...shadow.card,
  },
  name: {
    fontFamily: fonts.displayBold,
    fontSize: 21,
    color: colors.supplierDark,
    marginTop: 10,
  },
  role: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
    marginTop: 2,
  },
  live: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 9,
    backgroundColor: "#fff",
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.supplier,
  },
  liveText: {
    fontFamily: fonts.bodySemi,
    fontSize: 10.5,
    color: colors.supplierDark,
  },
  menu: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#DDEBE5",
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
    borderBottomColor: "#EDF3F0",
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.supplierBg,
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
  signOut: {
    marginTop: 16,
  },
});
