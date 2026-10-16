import React from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "../i18n";

import { Avatar, Button } from "./ui";
import { colors, fonts, radius } from "../theme/colors";
import { callPhone, prettyPhone } from "../utils/format";

function SafeChildren({ children }) {
  return React.Children.map(children, (child) => {
    if (typeof child === "string" || typeof child === "number") return <Text>{String(child)}</Text>;
    return child;
  });
}

/** A delivery partner: avatar, name, vehicle, phone and a Call button. */
export default function RiderCard({ rider, title, tone = "light", children }) {
  if (!rider) return null;
  return (
    <View style={[styles.box, tone === "good" && styles.boxGood]}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <View style={styles.row}>
        <Avatar name={rider.name} size={48} tone="#fff" />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{rider.name}</Text>
          {rider.vehicleNo ? <Text style={styles.meta}>{rider.vehicleNo}</Text> : null}
          {rider.phone ? <Text style={styles.meta}>{prettyPhone(rider.phone)}</Text> : null}
        </View>
        {rider.phone ? <Button title="Call" icon="phone" small variant="outline" onPress={() => callPhone(rider.phone)} /> : null}
      </View>
      <SafeChildren>{children}</SafeChildren>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: colors.can, borderRadius: radius.lg, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.canLine },
  boxGood: { backgroundColor: colors.can, borderColor: colors.canLine },
  title: { fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 0.4, color: colors.primary, marginBottom: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  name: { fontFamily: fonts.display, fontSize: 16, color: colors.primaryDark },
  meta: { fontFamily: fonts.body, fontSize: 12.5, color: colors.inkSoft, marginTop: 2 },
});
