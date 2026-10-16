import React, { useCallback, useEffect, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { Text } from "../../i18n";

import { cancelOrder, getOrderDetails, getOrderProof, getOrderRefund } from "../../api/customer";
import { Alert } from "../../utils/alert";
import { errorMessage } from "../../api/client";
import usePolling from "../../hooks/usePolling";
import RiderCard from "../../components/RiderCard";
import Timeline, { buildSteps } from "../../components/Timeline";
import TrackingCard from "../../components/TrackingCard";
import Icon from "../../components/Icon";
import RatingCard from "../../components/RatingCard";
import { Button, Card, ErrorBanner, Loading, Row, Screen, SectionTitle, StatusBadge } from "../../components/ui";
import { colors, fonts } from "../../theme/colors";
import { itemsSummary, money } from "../../utils/format";
import { useRealtime } from "../../realtime/RealtimeContext";

/* "8. Track Order" */
export default function TrackOrder({ route, navigation }) {
  const { orderId } = route.params;
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [proof, setProof] = useState(null);
  const [refund, setRefund] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const { subscribe } = useRealtime();

  const load = useCallback(async () => {
    try {
      const o = await getOrderDetails(orderId);
      setOrder(o);
      setError("");
      if (o.status === "delivered" || o.status === "settled") getOrderProof(orderId).then(setProof).catch(() => {});
      if (o.paymentMethod === "UPI" && (o.status === "cancelled" || o.status === "failed" || o.status === "fallback_offered")) {
        getOrderRefund(orderId).then(setRefund).catch(() => {});
      }
    } catch (e) {
      setError(errorMessage(e, "Could not load this order."));
    }
  }, [orderId]);
  usePolling(load, 6000);

  useEffect(() => {
    return subscribe((message) => {
      if (message?.data?.orderId !== orderId) return;
      if (message.event === "rider.location") {
        setOrder((current) => current ? { ...current, riderLocation: message.data.location } : current);
        return;
      }
      if (message.event === "order.updated" || message.event === "reconnected") {
        load();
      }
    });
  }, [orderId, subscribe, load]);

  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };
  const back = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Tabs"));

  if (!order) {
    return (
      <Screen title="Track Your Order" onBack={back} scroll={false}>
        {error ? <ErrorBanner message={error} onRetry={load} /> : <Loading />}
      </Screen>
    );
  }

  const cancelled = order.status === "cancelled" || order.status === "failed";
  const declined = order.status === "fallback_offered"; // the supplier turned the order down
  const paidOnline = order.paymentMethod === "UPI" && order.paymentStatus === "PAID";

  const cancel = (thenOrderElsewhere) =>
    Alert.alert(
      "Cancel This Order?",
      paidOnline ? "Your UPI payment will be refunded in full." : "You will not be charged.",
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Cancel Order",
          style: "destructive",
          onPress: async () => {
            setCancelling(true);
            try {
              await cancelOrder(order.id);
              await load();
              if (thenOrderElsewhere) navigation.navigate("Tabs", { screen: "Order" });
            } catch (e) {
              Alert.alert("Could Not Cancel", errorMessage(e));
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );

  return (
    <Screen title="Track Your Order" subtitle={`Order #${order.code}`} onBack={back} refreshing={refreshing} onRefresh={refresh}>
      <ErrorBanner message={error} onRetry={load} />

      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.supplier}>{order.eta && !cancelled ? `Arriving by ${order.eta}` : "Your Water Delivery"}</Text>
          <Text style={styles.routeHint}>
            {order.rider?.name && order.status === "out_for_delivery"
              ? `You're next on ${order.rider.name}'s route.`
              : order.rider?.name && order.status === "picked_up"
                ? `${order.rider.name} has picked up your order.`
                : `${order.supplier?.name || "Your Supplier"} is handling this order.`}
          </Text>
        </View>
        <StatusBadge status={order.status} />
      </View>

      {declined ? (
        <View style={styles.cancelled}>
          <View style={styles.declinedHead}>
            <Icon name="alert-circle" size={22} color={colors.danger} />
            <Text style={styles.declinedTitle}>{`${order.supplier?.name || "Your supplier"} could not accept your order`}</Text>
          </View>
          {order.declineReason ? <Text style={styles.declinedReason}>Reason: {order.declineReason}</Text> : null}
          <Text style={styles.declinedText}>
            {paidOnline ? "Cancel the order for a full refund, or order from another supplier." : "You can cancel the order or order from another supplier."}
          </Text>
          <View style={styles.declinedActions}>
            <Button title="Order From Another Supplier" small busy={cancelling} onPress={() => cancel(true)} />
            <Button title="Cancel Order" variant="outline" small disabled={cancelling} onPress={() => cancel(false)} />
          </View>
        </View>
      ) : cancelled ? (
        <View style={styles.cancelled}>
          <Text style={styles.cancelledText}>
            {order.status === "cancelled" ? "This order was cancelled." : "The supplier could not fulfil this order."}
          </Text>
          {refund ? <Text style={styles.declinedText}>{refund.status === "processed" ? "Your payment has been refunded." : "Your refund is on its way. It can take a few days to reach your account."}</Text> : null}
        </View>
      ) : (
        <>
          {order.deliveryCode ? (
            <Card style={styles.codeCard}>
              <Text style={styles.codeLabel}>Your Delivery Code</Text>
              <Text style={styles.code} accessibilityLabel={`Delivery code ${order.deliveryCode.split("").join(" ")}`}>{order.deliveryCode.split("").join("  ")}</Text>
              <Text style={styles.codeHint}>Give this code to the rider only when you have received your cans.</Text>
            </Card>
          ) : null}
          {order.status === "out_for_delivery" ? <TrackingCard order={order} address={order.deliveryAddress} /> : null}
          {order.rider ? (
            <RiderCard rider={order.rider} title="Your Delivery Partner" tone="good" />
          ) : (
            <Card style={styles.waitingCard}>
              <Text style={styles.waitingTitle}>Rider Assignment in Progress</Text>
              <Text style={styles.waitingText}>Your supplier has accepted the order. A delivery rider will be assigned before it is picked up.</Text>
            </Card>
          )}
          <Card>
            <Timeline steps={buildSteps(order)} />
          </Card>
        </>
      )}

      <Text style={styles.exchangeNote}>Keep your empty cans ready if your supplier collects them.</Text>
      <SectionTitle>Order Details</SectionTitle>
      <Card>
        <Row label="Items" value={itemsSummary(order)} />
        <Row label="Delivery" value={order.orderType === "recurring" ? "Recurring" : "One-time"} />
        {order.deliveryAddress ? <Row label="Deliver To" value={order.deliveryAddress} /> : null}
        {order.deliveryInstructions ? <Row label="Instructions" value={order.deliveryInstructions} /> : null}
        <Row label="Payment" value={order.paymentMethod === "UPI" ? "UPI" : "Cash on Delivery"} />
        <Row label="Total" value={money(order.totalPaise)} bold />
      </Card>

      {proof ? (
        <>
          <SectionTitle>Proof of Delivery</SectionTitle>
          <Card>
            <Text style={styles.proofText}>{proof.method === "code" ? "Confirmed with your delivery code." : "The rider confirmed delivery with a photo."}</Text>
            {proof.photo ? <Image source={{ uri: proof.photo }} style={styles.proofImage} resizeMode="cover" accessibilityLabel="Proof of delivery photo" /> : null}
            {proof.note ? <Text style={styles.proofNote}>{proof.note}</Text> : null}
          </Card>
        </>
      ) : null}
      {order.status === "delivered" || order.status === "settled" ? <RatingCard order={order} onRated={setOrder} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  supplier: { fontFamily: fonts.display, fontSize: 18, color: colors.primaryDark },
  eta: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft, marginTop: 2 },
  routeHint: { fontFamily: fonts.body, fontSize: 11.5, color: colors.inkSoft, marginTop: 4, lineHeight: 16 },
  exchangeNote: { fontFamily: fonts.body, fontSize: 10.5, color: colors.inkSoft, textAlign: "center", marginVertical: 12 },
  cancelled: { backgroundColor: colors.dangerBg, borderRadius: 14, padding: 16, marginBottom: 12 },
  cancelledText: { fontFamily: fonts.bodySemi, color: colors.danger, fontSize: 14 },
  declinedHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  declinedTitle: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 15, color: colors.danger },
  declinedReason: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.ink, marginTop: 8 },
  declinedText: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft, marginTop: 6, lineHeight: 19 },
  declinedActions: { gap: 8, marginTop: 12 },
  codeCard: { alignItems: "center", backgroundColor: colors.can, borderColor: colors.accent, borderWidth: 1.5 },
  codeLabel: { fontFamily: fonts.bodySemi, fontSize: 12.5, color: colors.inkSoft },
  code: { fontFamily: fonts.displayBold, fontSize: 38, color: colors.primaryDark, marginVertical: 6 },
  codeHint: { fontFamily: fonts.body, fontSize: 12, color: colors.inkSoft, textAlign: "center" },
  proofText: { fontFamily: fonts.body, fontSize: 13.5, color: colors.ink },
  proofImage: { width: "100%", height: 200, borderRadius: 12, marginTop: 10, backgroundColor: colors.can },
  proofNote: { fontFamily: fonts.body, fontSize: 12.5, color: colors.inkSoft, marginTop: 8 },
  waitingCard: { backgroundColor: colors.can, borderColor: colors.canLine },
  waitingTitle: { fontFamily: fonts.display, fontSize: 15.5, color: colors.primaryDark },
  waitingText: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: colors.inkSoft, marginTop: 5 },
});
