import React, { useCallback, useEffect, useState } from "react";
import { AppState, Linking, Pressable, StyleSheet, View } from "react-native";
import { Text } from "../../i18n";

import { getNotifications, markAllNotificationsRead, markNotificationRead } from "../../api/notifications";
import { errorMessage } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import usePolling from "../../hooks/usePolling";
import Icon from "../../components/Icon";
import { Button, Card, EmptyState, ErrorBanner, Loading, Screen } from "../../components/ui";
import { colors, fonts } from "../../theme/colors";
import { formatDateTime } from "../../utils/format";
import { useRealtime } from "../../realtime/RealtimeContext";
import { notificationsAllowed } from "../../notifications/localNotify";

const ICON = {
  "order.created": "package",
  "order.placed": "package",
  "order.updated": "truck",
  "order.declined": "alert-circle",
  "delivery.assigned": "truck",
  "delivery.ready": "truck",
  "delivery.cancelled": "alert-circle",
  "delivery.changed": "alert-circle",
  "delivery.attention": "alert-circle",
  "stock.low": "droplet",
  "rider.pending": "user-check",
  "rider.approval": "user-check",
};

/* Notifications for the signed-in customer, supplier or rider. Opens the related order when there is one. */
export default function NotificationsScreen({ navigation }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const { setUnreadCount } = useRealtime();
  const [allowed, setAllowed] = useState(null); // are phone notifications switched on for this app?

  useEffect(() => {
    const check = () => notificationsAllowed().then(setAllowed);
    check();
    const sub = AppState.addEventListener("change", (state) => { if (state === "active") check(); });
    return () => sub.remove();
  }, []);

  const load = useCallback(async () => {
    try { const d = await getNotifications(); setData(d); setUnreadCount(d.unreadCount || 0); setError(""); }
    catch (e) { setError(errorMessage(e, "Could not load notifications.")); }
  }, [setUnreadCount]);
  usePolling(load, 15000);

  const markAll = async () => {
    try { await markAllNotificationsRead(); await load(); } catch (e) { setError(errorMessage(e)); }
  };

  // Reading a notification moves it from "unread" to "read" straight away (the server is told in the background).
  const open = (n) => {
    if (!n.readAt) {
      const now = new Date().toISOString();
      setData((d) => d && { ...d, items: d.items.map((x) => (x.id === n.id ? { ...x, readAt: now } : x)), unreadCount: Math.max(0, (d.unreadCount || 0) - 1) });
      setUnreadCount((c) => Math.max(0, c - 1));
      markNotificationRead(n.id).then(load).catch(() => load());
    }
    if (!n.orderId) return;
    if (user.role === "CUSTOMER") navigation.navigate("TrackOrder", { orderId: n.orderId });
    else if (user.role === "SUPPLIER") navigation.navigate("SupplierOrder", { orderId: n.orderId });
    else navigation.navigate("DeliveryDetail", { orderId: n.orderId });
  };

  return (
    <Screen title="Notifications" subtitle={data && data.unreadCount ? `${data.unreadCount} unread` : "You are all caught up"} onBack={() => navigation.goBack()}>
      <ErrorBanner message={error} onRetry={load} />
      {!data && !error ? <Loading /> : null}
      {data && data.items.length === 0 ? <EmptyState icon="bell" title="No Notifications Yet" text="Order and delivery updates will show up here." /> : null}
      {allowed === false ? (
        <Card style={styles.notice}>
          <Text style={styles.noticeText}>Phone notifications are turned off for Water'O'Water. You will still see updates here and in the app while it is open.</Text>
          <Button title="Turn On in Settings" variant="soft" small onPress={() => Linking.openSettings().catch(() => {})} style={{ marginTop: 8 }} />
        </Card>
      ) : null}
      {data && data.unreadCount ? <Button title="Mark All as Read" variant="soft" small onPress={markAll} style={{ marginBottom: 12 }} /> : null}
      {(data ? data.items : []).map((n) => (
        <Pressable key={n.id} onPress={() => open(n)} accessibilityRole="button">
          <Card style={[styles.row, n.readAt ? styles.read : styles.unread]}>
            <View style={[styles.icon, n.readAt && styles.iconRead]}><Icon name={ICON[n.type] || "bell"} size={18} color={n.readAt ? colors.inkFaint : colors.primary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, n.readAt && styles.titleRead]}>{n.title}</Text>
              {n.body ? <Text style={[styles.body, n.readAt && styles.bodyRead]}>{n.body}</Text> : null}
              <Text style={styles.time}>{formatDateTime(n.createdAt)}</Text>
            </View>
            {!n.readAt ? <View style={styles.dot} /> : null}
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  notice: { marginBottom: 12, backgroundColor: "#FFF7E6", borderColor: "#F3DFAE" },
  noticeText: { fontFamily: fonts.body, fontSize: 12.5, color: colors.inkSoft, lineHeight: 18 },
  row: { flexDirection: "row", gap: 12, alignItems: "flex-start", marginBottom: 10 },
  // Unread: white card, bright accent edge, bold title, dot. Read: flat grey-blue card, no edge, lighter text, no dot.
  unread: { borderColor: colors.accent, borderWidth: 1.5, backgroundColor: "#FFFFFF" },
  read: { backgroundColor: "#EDF3F6", borderColor: "#E1ECF2", shadowOpacity: 0, elevation: 0 },
  iconRead: { backgroundColor: "#E1EAEF" },
  titleRead: { fontFamily: fonts.bodyMedium, color: colors.inkSoft },
  bodyRead: { color: colors.inkFaint },
  icon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.can, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
  body: { fontFamily: fonts.body, fontSize: 12.5, color: colors.inkSoft, marginTop: 3, lineHeight: 18 },
  time: { fontFamily: fonts.body, fontSize: 11, color: colors.inkFaint, marginTop: 6 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.accent, marginTop: 4 },
});
