import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "../i18n";
import Icon from "./Icon";
import { useAuth } from "../context/AuthContext";
import { useRealtime } from "../realtime/RealtimeContext";
import { openNotificationList } from "../navigation/navRef";
import { colors, fonts } from "../theme/colors";

/*
 * The notification bell shown at the top of every screen for Customer, Supplier and Rider.
 * A number badge shows how many notifications are still unread; it disappears when all are read.
 */
export default function NotificationBell({ style }) {
  const { user } = useAuth();
  const { unreadCount } = useRealtime();
  if (!user) return null;
  // A rider still waiting for ID approval has no notifications screen yet.
  if (user.role === "RIDER" && user.approvalStatus && user.approvalStatus !== "approved") return null;
  const label = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <Pressable
      onPress={openNotificationList}
      hitSlop={6}
      style={({ pressed }) => [styles.bell, style, pressed && { opacity: 0.8 }]}
      accessibilityRole="button"
      accessibilityLabel={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"}
    >
      <Icon name="bell" size={20} color={colors.primaryDark} />
      {unreadCount > 0 ? (
        <View style={styles.badge}><Text style={styles.badgeText}>{label}</Text></View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bell: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: colors.canLine, alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", top: -3, right: -3, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.danger, borderWidth: 1.5, borderColor: "#fff", alignItems: "center", justifyContent: "center" },
  badgeText: { fontFamily: fonts.bodyBold, fontSize: 10, lineHeight: 13, color: "#fff" },
});
