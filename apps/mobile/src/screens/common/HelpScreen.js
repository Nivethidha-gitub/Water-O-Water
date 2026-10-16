import React from "react";
import { Linking, StyleSheet, View } from "react-native";
import { Text } from "../../i18n";

import { Button, Card, Screen, SectionTitle } from "../../components/ui";
import { colors, fonts } from "../../theme/colors";

// Set these in the app's environment (see .env.example). The buttons only appear when they are set.
const SUPPORT_PHONE = process.env.EXPO_PUBLIC_SUPPORT_PHONE;
const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL;

const FAQ = [
  ["When will my water arrive?", "Open Track to see your order, the delivery partner and the expected time."],
  ["How do I pay?", "Choose cash on delivery or UPI at checkout. UPI orders are confirmed once the payment is verified."],
  ["My order was rejected. What now?", "You are notified straight away. Cancel it (online payments are refunded in full) or order from another supplier."],
  ["What is the delivery code?", "A 4-digit code shown on your tracking screen. Give it to the rider only when you have received your cans."],
];

export default function HelpScreen({ navigation }) {
  return (
    <Screen title="Help & Support" subtitle="Answers and ways to reach us" onBack={() => navigation.goBack()}>
      {FAQ.map(([q, a]) => (
        <Card key={q} style={{ marginBottom: 10 }}>
          <Text style={styles.q}>{q}</Text>
          <Text style={styles.a}>{a}</Text>
        </Card>
      ))}
      {SUPPORT_PHONE || SUPPORT_EMAIL ? <SectionTitle>Contact Us</SectionTitle> : null}
      <View style={{ gap: 10 }}>
        {SUPPORT_PHONE ? <Button title="Call Support" icon="phone" onPress={() => Linking.openURL(`tel:${SUPPORT_PHONE}`)} /> : null}
        {SUPPORT_EMAIL ? <Button title="Email Support" icon="mail" variant="outline" onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)} /> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  q: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.primaryDark },
  a: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft, marginTop: 5, lineHeight: 19 },
});
