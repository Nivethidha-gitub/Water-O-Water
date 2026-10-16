import React, { useCallback, useState } from "react";
import ReasonSheet, { ORDER_REASONS } from "../../components/ReasonSheet";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "../../i18n";
import { Alert } from "../../utils/alert";

import { acceptOrder, assignRider, getOrder, getRiders, markOrderReady, prepareOrder, rejectOrder } from "../../api/supplier";
import { errorMessage } from "../../api/client";
import usePolling from "../../hooks/usePolling";
import RiderCard from "../../components/RiderCard";
import TrackingCard from "../../components/TrackingCard";
import { Avatar, Button, Card, EmptyState, ErrorBanner, Loading, Row, Screen, SectionTitle, StatusBadge } from "../../components/ui";
import { colors, fonts, radius } from "../../theme/colors";
import { callPhone, formatDateTime, isDelivered, itemsSummary, money, prettyPhone, timeOf } from "../../utils/format";

/*
 * One screen for the supplier's part of an order:
 *   Accept -> Start Preparing -> Ready for Pickup, plus assigning a rider.
 * The rider then picks it up, starts the delivery and marks it delivered (with the customer's code).
 * The supplier can never mark an order as delivered. The panel below changes with the order status.
 */
// The steps where the supplier is still working on the order (rider can be assigned or changed).
const SUPPLIER_STEPS = ["accepted", "preparing", "ready_for_pickup"];

export default function OrderDetail({ route, navigation }) {
  const { orderId } = route.params;
  const [order, setOrder] = useState(null);
  const [riders, setRiders] = useState([]);
  const [selected, setSelected] = useState(null);
  const [changing, setChanging] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [o, r0] = await Promise.all([getOrder(orderId), getRiders()]);
      const r = (r0 || []).filter((x) => x.approvalStatus !== "pending" && x.approvalStatus !== "rejected");
      setOrder(o);
      setRiders(r);
      setError("");
    } catch (e) {
      setError(errorMessage(e, "Could not load this order."));
    }
  }, [orderId]);
  usePolling(load, 8000);
  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const [rejecting, setRejecting] = useState(false);
  const run = async (key, fn, failTitle) => {
    setBusy(key);
    try { await fn(); await load(); }
    catch (e) { Alert.alert(failTitle, errorMessage(e)); await load(); }
    finally { setBusy(""); }
  };

  const back = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Tabs"));

  if (!order) {
    return (
      <Screen title="Order" onBack={back} scroll={false}>
        {error ? <ErrorBanner message={error} onRetry={load} /> : <Loading />}
      </Screen>
    );
  }

  const { status, rider, customer } = order;
  const delivered = isDelivered(status);

  const assign = () =>
    run("assign", async () => {
      await assignRider(order.id, selected);
      setSelected(null);
      setChanging(false);
    }, "Could Not Assign Rider");

  const picker = (
    <>
      <SectionTitle>Assign Delivery Partner</SectionTitle>
      {riders.length === 0 ? (
        <EmptyState icon="truck" title="No Delivery Partners Yet" text="Riders create a Rider account in this app and choose your business. They will show up here." />
      ) : (
        <>
          {riders.map((r) => {
            const on = selected === r.id;
            return (
              <Pressable key={r.id} onPress={() => r.online !== false && setSelected(r.id)} disabled={r.online === false} style={[styles.rider, on && styles.riderOn, r.online === false && { opacity: 0.5 }]}>
                <Avatar name={r.name} size={42} tone="#fff" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.riderName}>{r.name}</Text>
                  <Text style={styles.riderMeta}>{[r.vehicleNo, r.online === false ? "Offline" : `${r.activeDeliveries} active`].filter(Boolean).join(" · ")}</Text>
                </View>
                <View style={[styles.radio, on && styles.radioOn]}>{on ? <View style={styles.radioDot} /> : null}</View>
              </Pressable>
            );
          })}
          <Button title="Assign Rider" variant="success" disabled={!selected} busy={busy === "assign"} onPress={assign} style={{ marginTop: 6 }} />
        </>
      )}
    </>
  );

  return (
    <Screen title={`Order #${order.code}`} subtitle={order.createdAt ? formatDateTime(order.createdAt) : undefined} onBack={back} refreshing={refreshing} onRefresh={refresh}>
      <ErrorBanner message={error} onRetry={load} />

      <View style={styles.statusRow}>
        <StatusBadge status={status} label={status === "placed" ? "New" : undefined} />
        {order.eta && !delivered && status !== "cancelled" ? <Text style={styles.eta}>Expected {order.eta}</Text> : null}
      </View>

      <Card>
        <Text style={styles.cardTitle}>Customer</Text>
        <Row label="Name" value={customer?.name || "—"} />
        {customer?.phone ? <Row label="Phone" value={prettyPhone(customer.phone)} /> : null}
        {customer?.address ? <Row label="Address" value={customer.address} /> : null}
        {customer?.phone ? (
          <Button title="Call Customer" icon="phone" variant="outline" small onPress={() => callPhone(customer.phone)} style={{ marginTop: 8 }} />
        ) : null}
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Items</Text>
        <Row label="Order" value={itemsSummary(order)} />
        <Row label="Total" value={money(order.totalPaise)} bold />
      </Card>

      {/* ---- the step the order is at ---- */}
      <ReasonSheet
        visible={rejecting}
        title="Reject This Order?"
        subtitle="The customer is told straight away."
        reasons={ORDER_REASONS}
        onClose={() => setRejecting(false)}
        onConfirm={(reason) => { setRejecting(false); run("reject", () => rejectOrder(order.id, reason), "Could Not Reject"); }}
      />
      {status === "placed" && (
        <View style={styles.actions}>
          <Button title="Accept" variant="success" busy={busy === "accept"} onPress={() => run("accept", () => acceptOrder(order.id), "Could Not Accept")} style={{ flex: 1 }} />
          <Button title="Reject" variant="danger" disabled={!!busy} style={{ flex: 1 }} onPress={() => setRejecting(true)} />
        </View>
      )}

      {/* ---- accepted -> preparing -> ready for pickup (supplier) ---- */}
      {SUPPLIER_STEPS.includes(status) && (
        <>
          {status === "accepted" && (
            <Button title="Start Preparing" icon="play" busy={busy === "prepare"} onPress={() => run("prepare", () => prepareOrder(order.id), "Could Not Update Order")} style={{ marginBottom: 12 }} />
          )}
          {status === "preparing" && (
            <Button title="Mark Ready for Pickup" icon="package" variant="success" busy={busy === "ready"} onPress={() => run("ready", () => markOrderReady(order.id), "Could Not Update Order")} style={{ marginBottom: 12 }} />
          )}
          {status === "ready_for_pickup" && (
            <View style={styles.note}>
              <Text style={styles.noteText}>
                {!rider
                  ? "Assign a delivery partner so the order can be collected."
                  : order.riderAcceptedAt
                    ? `Waiting for ${rider.name} to pick up the order.`
                    : `Waiting for ${rider.name} to accept and pick up the order.`}
              </Text>
            </View>
          )}

          {!rider || changing ? picker : (
            <>
              <RiderCard rider={rider} title={order.riderAcceptedAt ? "Rider Accepted" : "Rider Assigned"} tone="info" />
              <Button title="Change Rider" variant="outline" small onPress={() => setChanging(true)} style={{ marginTop: 10 }} />
            </>
          )}
        </>
      )}

      {/* ---- the rider's part: the supplier can only watch ---- */}
      {(status === "picked_up" || status === "out_for_delivery") && (
        <>
          <RiderCard rider={rider} title={status === "picked_up" ? "Picked Up by Rider" : "Out for Delivery"} />
          {status === "out_for_delivery" ? <TrackingCard order={order} address={customer?.address} showDestination={false} /> : null}
          <View style={styles.note}>
            <Text style={styles.noteText}>
              Only the delivery partner can mark this order as delivered, after handing it to the customer.
            </Text>
          </View>
        </>
      )}

      {delivered && (
        <View style={styles.done}>
          <Text style={styles.doneIcon}>✓</Text>
          <Text style={styles.doneTitle}>Delivered</Text>
          <Text style={styles.doneSub}>
            {timeOf(order, "delivered") ? `Delivered at ${formatDateTime(timeOf(order, "delivered"))}` : "This order is complete."}
          </Text>
          {rider ? <Text style={styles.doneSub}>By {rider.name}</Text> : null}
        </View>
      )}

      {(status === "cancelled" || status === "failed") && (
        <View style={styles.cancelled}><Text style={styles.cancelledText}>This order is {status === "cancelled" ? "cancelled" : "unfulfilled"}.</Text></View>
      )}

      {status === "fallback_offered" && (
        <View style={styles.cancelled}><Text style={styles.cancelledText}>This order is being offered to another supplier.</Text></View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  statusRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  eta: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft },
  cardTitle: { fontFamily: fonts.display, fontSize: 15, color: colors.primaryDark, marginBottom: 6 },
  actions: { flexDirection: "row", gap: 10 },
  note: { backgroundColor: colors.can, borderRadius: radius.lg, padding: 14, marginBottom: 12 },
  noteText: { fontFamily: fonts.bodySemi, fontSize: 13.5, color: colors.primaryDark, lineHeight: 19 },
  rider: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderRadius: radius.lg, padding: 12, marginBottom: 10, borderWidth: 1.5, borderColor: "#E3EEF2" },
  riderOn: { backgroundColor: colors.goodBg, borderColor: colors.good },
  riderName: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  riderMeta: { fontFamily: fonts.body, fontSize: 12.5, color: colors.inkSoft, marginTop: 1 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.canLine, alignItems: "center", justifyContent: "center" },
  radioOn: { borderColor: colors.good },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: colors.good },
  done: { alignItems: "center", backgroundColor: colors.goodBg, borderRadius: radius.lg, padding: 22 },
  doneIcon: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.good, color: "#fff", textAlign: "center", textAlignVertical: "center", lineHeight: 54, fontSize: 28, overflow: "hidden", fontFamily: fonts.bodyBold },
  doneTitle: { fontFamily: fonts.display, fontSize: 20, color: colors.primaryDark, marginTop: 10 },
  doneSub: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft, marginTop: 4 },
  cancelled: { backgroundColor: colors.dangerBg, borderRadius: 14, padding: 16 },
  cancelledText: { fontFamily: fonts.bodySemi, color: colors.danger, fontSize: 14 },
});
