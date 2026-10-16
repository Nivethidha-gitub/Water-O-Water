import React, { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "../../i18n";
import Icon from "../../components/Icon";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Alert } from "../../utils/alert";

import { acceptDelivery, completeDelivery, getMyDeliveries, pickupDelivery, setDeliveryEta, startDelivery } from "../../api/rider";
import { errorMessage } from "../../api/client";
import usePolling from "../../hooks/usePolling";
import DeliveryForm from "../../components/DeliveryForm";
import TrackingCard from "../../components/TrackingCard";
import { Button, Card, ErrorBanner, Field, Loading, Row, Screen, StatusBadge } from "../../components/ui";
import { colors, fonts, radius, shadow } from "../../theme/colors";
import { callPhone, formatDateTime, isDelivered, itemsSummary, money, openMaps, prettyPhone, riderNextAction, timeOf } from "../../utils/format";

export default function DeliveryDetail({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { orderId } = route.params;
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [etaInput, setEtaInput] = useState("");
  const [emptiesIn, setEmptiesIn] = useState(null);

  const load = useCallback(async () => {
    try {
      const { active, history } = await getMyDeliveries();
      const found = [...active, ...history].find((o) => o.id === orderId);
      if (found) {
        setOrder(found);
        setEtaInput(found.eta || "");
        setError("");
      } else setError("This delivery is no longer assigned to you.");
    } catch (e) {
      setError(errorMessage(e, "Could not load this delivery."));
    }
  }, [orderId]);

  usePolling(load, 8000);

  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };
  const back = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Tabs"));

  // One step of the rider's flow: accept -> picked up -> out for delivery. The server checks
  // that this is the assigned rider and that the order is at the right stage.
  const STEPS = {
    accept: [acceptDelivery, "Could Not Accept Delivery"],
    pickup: [pickupDelivery, "Could Not Mark as Picked Up"],
    start: [startDelivery, "Could Not Start Delivery"],
  };
  const step = async (key) => {
    setBusy(key);
    try { await STEPS[key][0](order.id); await load(); }
    catch (e) { Alert.alert(STEPS[key][1], errorMessage(e)); await load(); }
    finally { setBusy(""); }
  };

  const saveEta = async () => {
    if (!etaInput.trim()) return;
    setBusy("eta");
    try {
      const updated = await setDeliveryEta(order.id, etaInput.trim());
      setOrder(updated);
      Alert.alert("Delivery Time Updated", `Customer will see: ${updated.eta}`);
    } catch (e) {
      Alert.alert("Could not update delivery time", errorMessage(e));
    } finally { setBusy(""); }
  };

  const deliver = async (payload) => {
    setBusy("deliver");
    try {
      const result = await completeDelivery(order.id, payload);
      if (result.delivery && result.delivery.emptyIn != null) setEmptiesIn(Number(result.delivery.emptyIn));
      setOrder(result.order);
    } catch (e) {
      Alert.alert("Could Not Complete Delivery", errorMessage(e));
      await load();
    } finally { setBusy(""); }
  };

  if (!order) {
    return (
      <Screen title="Delivery Details" onBack={back} scroll={false}>
        {error ? <ErrorBanner message={error} onRetry={load} /> : <Loading />}
      </Screen>
    );
  }

  const { customer, status } = order;
  const delivered = isDelivered(status);
  const deliveredAt = timeOf(order, "delivered") || new Date().toISOString();

  if (delivered) {
    const paymentLine = order.paymentMethod === "UPI"
      ? (order.paymentStatus === "PAID" ? "UPI · Paid" : "UPI")
      : "Cash on Delivery";
    return (
      <View style={[styles.successScreen, { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 16 }]}>
        <StatusBar style="dark" />
        {/* Header: no background, no border */}
        <Text style={styles.successHeader} accessibilityRole="header">Delivery complete</Text>

        <View style={styles.successTop}>
          <View style={styles.checkHalo} accessibilityRole="image" accessibilityLabel="Delivered successfully">
            <View style={styles.checkRing}>
              <View style={styles.checkCircle}><Icon name="check" size={34} color="#fff" /></View>
            </View>
          </View>
          <Text style={styles.successTitle}>Delivered. Well done!</Text>
          <Text style={styles.successSub}>Another home, happily hydrated.{"\n"}Thanks for keeping the water flowing.</Text>
        </View>

        <View style={styles.detailCard}>
          <View style={styles.orderRow}>
            <Text style={styles.orderCode}>Order #{order.code}</Text>
            <View style={styles.deliveredPill}><Text style={styles.deliveredPillText}>Delivered</Text></View>
          </View>
          <Text style={styles.metaLine}>
            {[customer?.name, customer?.address, formatDateTime(deliveredAt)].filter(Boolean).join(" · ")}
          </Text>
          <View style={styles.factRow}>
            <Icon name="droplet" size={18} color={colors.primary} />
            <Text style={styles.factText}>{itemsSummary(order)} delivered</Text>
          </View>
          {emptiesIn != null ? (
            <View style={styles.factRow}>
              <Icon name="rotate-cw" size={18} color={colors.primary} />
              <Text style={styles.factText}>{emptiesIn} empty {emptiesIn === 1 ? "can" : "cans"} collected</Text>
            </View>
          ) : null}
          <Text style={styles.payLine}>Delivery partner: {order.rider?.name || order.riderName || "—"}</Text>
        </View>

        <View style={styles.amountCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.amountTitle}>{money(order.totalPaise)}</Text>
            <Text style={styles.amountSub}>{paymentLine}</Text>
          </View>
          <Icon name="credit-card" size={26} color={colors.primary} />
        </View>

        <View style={styles.successFooter}>
          <Button title="Ready for next delivery" icon="arrow-right" onPress={() => navigation.popToTop()} />
        </View>
      </View>
    );
  }

  return (
    <Screen title={`Order #${order.code}`} onBack={back} refreshing={refreshing} onRefresh={refresh}>
      <ErrorBanner message={error} onRetry={load} />

      <View style={styles.statusRow}>
        <StatusBadge status={status} />
        {order.eta ? <Text style={styles.eta}>Expected {order.eta}</Text> : null}
      </View>

      <Card>
        <Text style={styles.title}>Deliver to</Text>
        <Text style={styles.name}>{customer?.name}</Text>
        {customer?.address ? <Text style={styles.addr}>{customer.address}</Text> : null}
        {customer?.phone ? <Text style={styles.phone}>{prettyPhone(customer.phone)}</Text> : null}
        <View style={styles.btns}>
          {customer?.phone ? <Button title="Call" icon="phone" variant="outline" small onPress={() => callPhone(customer.phone)} style={{ flex: 1 }} /> : null}
          {customer?.address ? <Button title="Navigate" icon="navigation" variant="soft" small onPress={() => openMaps(customer.address)} style={{ flex: 1 }} /> : null}
        </View>
      </Card>

      <Card>
        <Text style={styles.title}>Delivery Timing</Text>
        <Text style={styles.helper}>Set the time you expect to reach the customer. They will see this on tracking.</Text>
        <Field
          label="Customer-Facing Delivery Time"
          value={etaInput}
          onChangeText={setEtaInput}
          placeholder="Today, 4:30 PM"
        />
        <Button title="Update Delivery Time" small variant="soft" onPress={saveEta} busy={busy === "eta"} />
      </Card>

      <Card>
        <Text style={styles.title}>Order</Text>
        <Row label="Items" value={itemsSummary(order)} />
        <Row label="Bill" value={money(order.totalPaise)} bold />
      </Card>

      {/* ---- the rider's steps ---- */}
      {(() => {
        const next = riderNextAction(order);
        if (!next || next.key === "deliver") return null;
        return <Button title={next.title} icon={next.key === "accept" ? "check" : next.key === "pickup" ? "package" : "play"} variant={next.variant} busy={busy === next.key} onPress={() => step(next.key)} />;
      })()}

      {(status === "accepted" || status === "preparing") && order.riderAcceptedAt && (
        <View style={styles.waitNote}><Text style={styles.waitText}>The supplier is preparing this order. You will be notified when it is ready for pickup.</Text></View>
      )}
      {(status === "accepted" || status === "preparing") && !order.riderAcceptedAt && (
        <View style={styles.waitNote}><Text style={styles.waitText}>Accept this delivery now. You can pick it up once the supplier marks it ready.</Text></View>
      )}
      {status === "ready_for_pickup" && order.riderAcceptedAt && (
        <View style={styles.waitNote}><Text style={styles.waitText}>The order is ready. Collect it from the supplier, then tap Mark as Picked Up.</Text></View>
      )}
      {status === "picked_up" && (
        <View style={styles.waitNote}><Text style={styles.waitText}>Tap Start Delivery when you leave for the customer. You can only complete the delivery once you are on the way.</Text></View>
      )}

      {status === "out_for_delivery" && (
        <>
          <TrackingCard order={order} address={customer?.address} navigate showDestination={false} />
          <DeliveryForm order={order} busy={busy === "deliver"} onSubmit={deliver} />
        </>
      )}

      {(status === "cancelled" || status === "failed") && (
        <View style={styles.cancelled}><Text style={styles.cancelledText}>This delivery was cancelled.</Text></View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  waitNote: { backgroundColor: colors.can, borderRadius: radius.lg, padding: 14, marginTop: 12 },
  waitText: { fontFamily: fonts.bodySemi, fontSize: 13.5, color: colors.primaryDark, lineHeight: 19 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  eta: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.primary },
  title: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 0.5, color: colors.primary, marginBottom: 8 },
  name: { fontFamily: fonts.displayBold, fontSize: 18, color: colors.ink },
  addr: { fontFamily: fonts.body, fontSize: 13.5, color: colors.ink, marginTop: 6, lineHeight: 20 },
  phone: { fontFamily: fonts.bodySemi, fontSize: 13.5, color: colors.inkSoft, marginTop: 4 },
  btns: { flexDirection: "row", gap: 10, marginTop: 12 },
  helper: { fontFamily: fonts.body, fontSize: 12, color: colors.inkSoft, lineHeight: 18, marginBottom: 10 },
  cancelled: { backgroundColor: colors.dangerBg, borderRadius: 14, padding: 16 },
  cancelledText: { fontFamily: fonts.bodySemi, color: colors.danger, fontSize: 14 },

  successScreen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 16 },
  successHeader: { fontFamily: fonts.displayBold, fontSize: 18, color: colors.primaryDark, backgroundColor: "transparent" },
  successTop: { alignItems: "center", paddingTop: 28, paddingBottom: 22 },
  checkHalo: { width: 124, height: 124, borderRadius: 62, backgroundColor: "#E4F2EC", alignItems: "center", justifyContent: "center" },
  checkRing: { width: 98, height: 98, borderRadius: 49, borderWidth: 1.5, borderColor: "#BFDDD0", alignItems: "center", justifyContent: "center" },
  checkCircle: { width: 70, height: 70, borderRadius: 35, backgroundColor: "#2A7A62", alignItems: "center", justifyContent: "center" },
  successTitle: { fontFamily: fonts.displayBold, fontSize: 24, color: colors.primaryDark, marginTop: 18, textAlign: "center" },
  successSub: { fontFamily: fonts.body, fontSize: 14, color: colors.inkSoft, marginTop: 8, textAlign: "center", lineHeight: 21 },
  detailCard: { backgroundColor: "#fff", borderRadius: 20, padding: 18, ...shadow.card },
  orderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  orderCode: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  deliveredPill: { backgroundColor: "#DDF0E8", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  deliveredPillText: { fontFamily: fonts.bodySemi, fontSize: 12, color: "#2A7A62" },
  metaLine: { fontFamily: fonts.body, fontSize: 13.5, color: colors.inkSoft, marginTop: 10, lineHeight: 20 },
  factRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 14 },
  factText: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.ink },
  payLine: { fontFamily: fonts.body, fontSize: 12.5, color: colors.inkSoft, marginTop: 16 },
  amountCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#E1F1F5", borderRadius: 18, padding: 18, marginTop: 14 },
  amountTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  amountSub: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft, marginTop: 3 },
  successFooter: { marginTop: "auto", paddingTop: 14 },
});
