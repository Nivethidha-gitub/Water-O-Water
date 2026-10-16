import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "../../i18n";
import { Alert } from "../../utils/alert";

import { acceptOrder, getOrders, getProducts, getRiders, rejectOrder } from "../../api/supplier";
import { errorMessage } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import usePolling from "../../hooks/usePolling";
import Icon from "../../components/Icon";
import ReasonSheet, { ORDER_REASONS } from "../../components/ReasonSheet";
import { Button, Card, ErrorBanner, Loading, Screen } from "../../components/ui";
import { colors, fonts, radius, shadow } from "../../theme/colors";
import { firstName, greeting, isDelivered, isInProgress, itemsSummary, money, timeOf } from "../../utils/format";

const DAY = 86400000;
const startOfDay = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/*
 * Supplier dashboard, in the order a supplier works through it:
 *   1. Pending      - everything waiting on you (new orders, riders to assign, IDs to approve)
 *   2. New Orders   - the latest orders, accept or reject right here
 *   3. Quick Review - how the day is going
 *   4. Earnings     - today and the last 7 days
 */
export default function SupplierHome({ navigation }) {
  const { user } = useAuth();
  const [orders, setOrders] = useState(null);
  const [riders, setRiders] = useState([]);
  const [products, setProducts] = useState([]);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [rejecting, setRejecting] = useState(null);

  const load = useCallback(async () => {
    try {
      const [o, r, p] = await Promise.all([getOrders(), getRiders().catch(() => []), getProducts().catch(() => [])]);
      setOrders(o); setRiders(r || []); setProducts(p || []); setError("");
    } catch (e) {
      setError(errorMessage(e, "Could not load your dashboard."));
    }
  }, []);
  usePolling(load, 10000);
  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const accept = async (order) => {
    setBusyId(order.id);
    try { await acceptOrder(order.id); await load(); }
    catch (e) { Alert.alert("Could Not Accept", errorMessage(e)); await load(); }
    finally { setBusyId(null); }
  };
  const confirmReject = async (reason) => {
    const order = rejecting;
    setRejecting(null);
    setBusyId(order.id);
    try { await rejectOrder(order.id, reason); await load(); }
    catch (e) { Alert.alert("Could Not Reject", errorMessage(e)); await load(); }
    finally { setBusyId(null); }
  };

  if (!orders && !error) return <Screen scroll={false}><Loading /></Screen>;

  const list = orders || [];
  const fresh = list.filter((o) => o.status === "placed").sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const needRider = list.filter((o) => ["accepted", "preparing", "ready_for_pickup"].includes(o.status) && !o.rider).length;
  const idPending = riders.filter((r) => r.approvalStatus === "pending").length;
  const pendingTotal = fresh.length + needRider + idPending;

  const approved = riders.filter((r) => r.approvalStatus !== "pending" && r.approvalStatus !== "rejected");
  const online = approved.filter((r) => r.online).length;
  const inProgress = list.filter((o) => isInProgress(o.status)).length;
  const lowStock = products.filter((p) => p.stockTracked && (!p.inStock || p.lowStock)).length;

  // Earnings = value of delivered orders, by the day they were delivered.
  const today0 = startOfDay(Date.now());
  const days = Array.from({ length: 7 }, (_, i) => {
    const from = today0 - (6 - i) * DAY;
    return { from, label: WEEKDAY[new Date(from).getDay()], paise: 0, count: 0 };
  });
  for (const o of list) {
    if (!isDelivered(o.status)) continue;
    const at = Date.parse(timeOf(o, "delivered") || o.createdAt);
    const slot = days.find((d) => at >= d.from && at < d.from + DAY);
    if (slot) { slot.paise += Number(o.totalPaise) || 0; slot.count += 1; }
  }
  const todayDay = days[6];
  const weekPaise = days.reduce((n, d) => n + d.paise, 0);
  const weekCount = days.reduce((n, d) => n + d.count, 0);
  const peak = Math.max(1, ...days.map((d) => d.paise));

  const pendingRows = [
    [fresh.length, "New orders to accept", "package", "Orders"],
    [needRider, "Accepted orders need a rider", "truck", "Orders"],
    [idPending, "Delivery partner IDs to approve", "user-check", "Riders"],
  ].filter(([n]) => n > 0);

  return (
    <Screen title="Dashboard" subtitle={user?.supplier?.name || "Supplier"} refreshing={refreshing} onRefresh={refresh} contentStyle={styles.content}>
      <ErrorBanner message={error} onRetry={load} />
      <Text style={styles.hi} numberOfLines={1}>{greeting()}, {firstName(user?.name)}</Text>

      {/* 1. Pending */}
      <View style={[styles.pending, !pendingTotal && styles.pendingCalm]}>
        <View style={styles.pendingHead}>
          <View style={styles.pendingBadge}><Text style={styles.pendingNum}>{pendingTotal}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.pendingTitle}>Pending</Text>
            <Text style={styles.pendingSub}>{pendingTotal ? "Waiting for your action" : "You are all caught up"}</Text>
          </View>
        </View>
        {pendingRows.map(([n, label, icon, screen]) => (
          <Pressable key={label} onPress={() => navigation.navigate(screen)} style={styles.pendingRow} accessibilityRole="button">
            <Icon name={icon} size={17} color="#FFFFFF" />
            <Text style={styles.pendingLabel}>{label}</Text>
            <Text style={styles.pendingCount}>{n}</Text>
            <Icon name="chevron-right" size={17} color="#FFFFFF" />
          </Pressable>
        ))}
      </View>

      {/* 2. New orders */}
      <SectionHead title="New Orders" action={fresh.length > 3 ? `View All (${fresh.length})` : null} onAction={() => navigation.navigate("Orders")} />
      {fresh.length === 0 ? (
        <Card style={styles.none}><Icon name="inbox" size={22} color={colors.inkFaint} /><Text style={styles.noneText}>No new orders right now. They appear here within seconds.</Text></Card>
      ) : (
        fresh.slice(0, 3).map((o) => (
          <Card key={o.id} style={styles.order}>
            <Pressable onPress={() => navigation.navigate("SupplierOrder", { orderId: o.id })} accessibilityRole="button">
              <View style={styles.orderTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.orderName}>{o.customer?.name || "Customer"}</Text>
                  <Text style={styles.orderMeta} numberOfLines={1}>{itemsSummary(o)}</Text>
                </View>
                <Text style={styles.orderTotal}>{money(o.totalPaise)}</Text>
              </View>
              {o.customer?.address ? <Text style={styles.orderAddr} numberOfLines={1}>{o.customer.address}</Text> : null}
            </Pressable>
            <View style={styles.orderActions}>
              <Button title="Accept" variant="success" small busy={busyId === o.id} onPress={() => accept(o)} style={{ flex: 1.2 }} />
              <Button title="Reject" variant="outline" small disabled={busyId === o.id} onPress={() => setRejecting(o)} style={{ flex: 1 }} />
            </View>
          </Card>
        ))
      )}

      {/* 3. Quick review */}
      <SectionHead title="Quick Review" />
      <View style={styles.grid}>
        {[
          ["truck", inProgress, "In Progress", "Orders"],
          ["check-circle", todayDay.count, "Delivered Today", "Orders"],
          ["users", `${online}/${approved.length}`, "Riders Online", "Riders"],
          ["droplet", lowStock, "Low or Out of Stock", "Products"],
        ].map(([icon, value, label, screen]) => (
          <Pressable key={label} onPress={() => navigation.navigate(screen)} style={({ pressed }) => [styles.tile, pressed && { opacity: 0.85 }]} accessibilityRole="button">
            <View style={styles.tileIcon}><Icon name={icon} size={18} /></View>
            <Text style={styles.tileValue}>{value}</Text>
            <Text style={styles.tileLabel} numberOfLines={1}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {/* 4. Earnings */}
      <SectionHead title="Earnings" />
      <Card>
        <View style={styles.earnTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.earnLabel}>Today</Text>
            <Text style={styles.earnToday}>{money(todayDay.paise)}</Text>
            <Text style={styles.earnSub}>{todayDay.count === 1 ? "1 delivery" : `${todayDay.count} deliveries`}</Text>
          </View>
          <View style={styles.earnWeek}>
            <Text style={styles.earnLabel}>Last 7 Days</Text>
            <Text style={styles.earnWeekValue}>{money(weekPaise)}</Text>
            <Text style={styles.earnSub}>{weekCount === 1 ? "1 delivery" : `${weekCount} deliveries`}</Text>
          </View>
        </View>
        <View style={styles.bars} accessibilityLabel="Earnings for the last 7 days">
          {days.map((d, i) => (
            <View key={d.from} style={styles.barCol}>
              <View style={styles.barTrack}>
                <View style={[styles.bar, i === 6 && styles.barToday, { height: `${Math.max(d.paise ? 8 : 3, (d.paise / peak) * 100)}%` }]} />
              </View>
              <Text style={[styles.barLabel, i === 6 && { color: colors.primaryDark, fontFamily: fonts.bodyBold }]}>{d.label}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.earnNote}>Earnings are the value of orders delivered.</Text>
      </Card>

      <ReasonSheet
        visible={!!rejecting}
        title="Reject This Order?"
        subtitle={rejecting ? `The customer is told straight away. Order #${rejecting.code}` : ""}
        reasons={ORDER_REASONS}
        onClose={() => setRejecting(null)}
        onConfirm={confirmReject}
      />
    </Screen>
  );
}

function SectionHead({ title, action, onAction }) {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.section}>{title}</Text>
      {action ? <Pressable onPress={onAction} hitSlop={8}><Text style={styles.sectionAction}>{action}</Text></Pressable> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 14, paddingBottom: 24 },
  hi: { fontFamily: fonts.body, fontSize: 14, color: colors.inkSoft, marginBottom: 12 },

  pending: { backgroundColor: colors.primaryDark, borderRadius: radius.xl, padding: 16, ...shadow.lift },
  pendingCalm: { backgroundColor: colors.primary },
  pendingHead: { flexDirection: "row", alignItems: "center", gap: 14 },
  pendingBadge: { width: 52, height: 52, borderRadius: 16, backgroundColor: "rgba(255,255,255,.14)", alignItems: "center", justifyContent: "center" },
  pendingNum: { fontFamily: fonts.displayBold, fontSize: 26, color: "#FFFFFF" },
  pendingTitle: { fontFamily: fonts.displayBold, fontSize: 19, color: "#FFFFFF" },
  pendingSub: { fontFamily: fonts.body, fontSize: 12.5, color: colors.onDarkSoft, marginTop: 1 },
  pendingRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(255,255,255,.1)", borderRadius: 14, paddingVertical: 11, paddingHorizontal: 12, marginTop: 10 },
  pendingLabel: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 13.5, color: "#FFFFFF" },
  pendingCount: { fontFamily: fonts.displayBold, fontSize: 16, color: "#FFFFFF" },

  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 22, marginBottom: 10 },
  section: { fontFamily: fonts.displayBold, fontSize: 17, color: colors.primaryDark },
  sectionAction: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.primary },

  none: { flexDirection: "row", alignItems: "center", gap: 12 },
  noneText: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft },
  order: { marginBottom: 10 },
  orderTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  orderName: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  orderMeta: { fontFamily: fonts.body, fontSize: 12.5, color: colors.inkSoft, marginTop: 2 },
  orderTotal: { fontFamily: fonts.displayBold, fontSize: 16, color: colors.primaryDark },
  orderAddr: { fontFamily: fonts.body, fontSize: 12, color: colors.inkFaint, marginTop: 6 },
  orderActions: { flexDirection: "row", gap: 10, marginTop: 12 },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: { width: "48.5%", backgroundColor: "#fff", borderRadius: radius.lg, padding: 13, borderWidth: 1, borderColor: colors.canLine, ...shadow.card },
  tileIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.can, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  tileValue: { fontFamily: fonts.displayBold, fontSize: 24, color: colors.primaryDark, lineHeight: 30 },
  tileLabel: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.inkSoft, marginTop: 1 },

  earnTop: { flexDirection: "row", gap: 12 },
  earnLabel: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.inkSoft },
  earnToday: { fontFamily: fonts.displayBold, fontSize: 30, color: colors.primaryDark, marginTop: 2 },
  earnWeek: { alignItems: "flex-end" },
  earnWeekValue: { fontFamily: fonts.displayBold, fontSize: 19, color: colors.primary, marginTop: 4 },
  earnSub: { fontFamily: fonts.body, fontSize: 12, color: colors.inkFaint, marginTop: 2 },
  bars: { flexDirection: "row", gap: 8, height: 92, marginTop: 16, alignItems: "flex-end" },
  barCol: { flex: 1, height: "100%", alignItems: "center" },
  barTrack: { flex: 1, width: "100%", justifyContent: "flex-end", alignItems: "center" },
  bar: { width: "70%", borderRadius: 6, backgroundColor: colors.canLine },
  barToday: { backgroundColor: colors.accent },
  barLabel: { fontFamily: fonts.body, fontSize: 10.5, color: colors.inkFaint, marginTop: 6 },
  earnNote: { fontFamily: fonts.body, fontSize: 11.5, color: colors.inkFaint, marginTop: 12 },
});
