import React from "react";
import { StyleSheet, View } from "react-native";
import { LanguageSwitch, Text } from "../../i18n";
import { useAuth } from "../../context/AuthContext";
import { useSignOut } from "../../components/Header";
import { Avatar, Button, Card, Row, Screen, SectionTitle } from "../../components/ui";
import { colors, fonts, radius, shadow } from "../../theme/colors";
import { prettyPhone } from "../../utils/format";

export default function RiderProfile() {
  const { user } = useAuth();
  const signOut = useSignOut();

  return (
    <Screen brand subtitle="Rider">
      <View style={styles.hero}>
        <Avatar name={user?.name} size={72} tone={colors.riderBg} />
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.role}>Delivery Rider</Text>
        <View style={styles.online}>
          <View style={styles.dot} />
          <Text style={styles.onlineText}>Available for Delivery</Text>
        </View>
      </View>

      <SectionTitle>Rider Details</SectionTitle>
      <Card>
        <Row label="Delivers for" value={user?.supplier?.name || "—"} />
        <Row label="Vehicle" value={user?.vehicleNo || "—"} />
        <Row label="Phone" value={user?.phone ? prettyPhone(user.phone) : "—"} />
        <Row label="Email" value={user?.email || "—"} />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Delivery Standard</Text>
        <Text style={styles.cardText}>
          Keep location sharing enabled while a delivery is active so customers can follow the rider in real time.
        </Text>
      </Card>

      <Button title="Sign Out" variant="danger" onPress={signOut} style={styles.signOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: "center",
    backgroundColor: colors.riderBg,
    borderRadius: radius.xl,
    paddingVertical: 21,
    borderWidth: 1,
    borderColor: "#F1D7AA",
    ...shadow.card,
  },
  name: {
    fontFamily: fonts.displayBold,
    fontSize: 21,
    color: colors.ink,
    marginTop: 10,
  },
  role: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
    marginTop: 2,
  },
  online: {
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
    backgroundColor: colors.rider,
  },
  onlineText: {
    fontFamily: fonts.bodySemi,
    fontSize: 10.5,
    color: colors.riderDark,
  },
  cardTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.ink,
  },
  cardText: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    color: colors.inkSoft,
    lineHeight: 18,
    marginTop: 4,
  },
  signOut: {
    marginTop: 4,
  },
});
