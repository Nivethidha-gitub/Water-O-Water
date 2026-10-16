import React, { useContext } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { NavigationContext, NavigationRouteContext } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LanguageToggle, Text } from "../i18n";
import Icon from "./Icon";
import NotificationBell from "./NotificationBell";
import { colors, fonts, radius } from "../theme/colors";

// Names shown in the header of the main (tab) screens.
const ROUTE_TITLES = {
  Home: "Home",
  Order: "Order Water",
  Track: "Track Order",
  Profile: "Profile",
  Orders: "Orders",
  Riders: "Delivery Partners",
  Products: "Products",
  More: "More",
  Deliveries: "Deliveries",
  History: "History",
  Verification: "Verification",
};

/*
 * Top bar for every screen: a back arrow, the screen's name, and the language switch.
 *  - Back arrow: goes to the previous page. On a main tab it goes back to Home.
 *    It is hidden on the Home screen itself (there is nowhere to go back to).
 *  - Title: the `title` the screen passes, otherwise the screen's name.
 *  - Bell: opens Notifications, with a number for unread ones (hidden on the Notifications page itself).
 */
export default function AppBar({ title, subtitle, onBack }) {
  const insets = useSafeAreaInsets();
  const navigation = useContext(NavigationContext);
  const route = useContext(NavigationRouteContext);

  const canGoBack = Boolean(onBack) || Boolean(navigation && navigation.canGoBack());
  const goBack = () => {
    if (onBack) onBack();
    else if (navigation && navigation.canGoBack()) navigation.goBack();
  };
  const name = title || (route ? ROUTE_TITLES[route.name] || route.name : "");

  return (
    <View style={[styles.bar, { paddingTop: insets.top + 8 }]}>
      {canGoBack ? (
        <Pressable
          onPress={goBack}
          style={({ pressed }) => [styles.back, pressed && { opacity: 0.7 }]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Icon name="arrow-left" size={22} color={colors.primaryDark} />
        </Pressable>
      ) : null}
      <View style={styles.titleBox}>
        <Text style={styles.title} numberOfLines={1} accessibilityRole="header">{name}</Text>
        {subtitle ? <Text style={styles.sub} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      <LanguageToggle tone="light" />
      {route && route.name === "Notifications" ? null : <NotificationBell />}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: "transparent",
  },
  back: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.can, alignItems: "center", justifyContent: "center" },
  titleBox: { flex: 1, minHeight: 40, justifyContent: "center" },
  title: { fontFamily: fonts.displayBold, fontSize: 18, color: colors.primaryDark },
  sub: { fontFamily: fonts.body, fontSize: 12, color: colors.inkSoft, marginTop: 1 },
});
