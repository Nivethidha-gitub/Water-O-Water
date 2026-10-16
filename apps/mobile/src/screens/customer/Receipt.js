import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "../../i18n";

import { getOrderDetails, getOrderRefund } from "../../api/customer";
import { errorMessage } from "../../api/client";
import RatingCard from "../../components/RatingCard";
import { Button, Card, ErrorBanner, Loading, Row, Screen, SectionTitle, StatusBadge } from "../../components/ui";
import { colors, fonts } from "../../theme/colors";
import { formatDateTime, isDelivered, isClosed, money, timeOf } from "../../utils/format";

const REFUND = { requested: "Refund Requested", pending: "Refund in Progress", processed: "Refunded", failed: "Refund Being Retried" };

/* Receipt for one order: items, totals, payment, address, delivery time, refund and rating. */
export default function Receipt({ route, navigation }) {
  const { orderId } = route.params;
  const [order, setOrder] = useState(null);
  const [refund, setRefund] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const o = await getOrderDetails(orderId);
      setOrder(o);
      setRefund(o.paymentMethod === "UPI" ? await getOrderRefund(orderId).catch(() => null) : null);
      setError("");
    } catch (e) {
      setError(errorMessage(e, "Could not load this receipt."));
    }
  }, [orderId]);
  useEffect(() => { load(); }, [load]);

  const back = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Tabs"));
  if (!order) {
    return <Screen title="Receipt" onBack={back} scroll={false}>{error ? <ErrorBanner message={error} onRetry={load} /> : <Loading />}</Screen>;
  }

  const online = order.paymentMethod === "UPI";
  const payment = online
    ? order.paymentStatus === "REFUNDED" ? "UPI · Refunded" : order.paymentStatus === "REFUND_PENDING" ? "UPI · Refund in Progress" : "UPI · Paid"
    : isDelivered(order.status) ? "Cash · Paid on Delivery" : "Cash on Delivery";
  const deliveredAt = timeOf(order, "delivered");

  return (
    <Screen title="Receipt" subtitle={`Order #${order.code}`} onBack={back}>
      <ErrorBanner message={error} onRetry={load} />
      <View style={styles.head}>
        <Text style={styles.date}>{formatDateTime(order.createdAt)}</Text>
        <StatusBadge status={order.status} />
      </View>

      <SectionTitle>Order Summary</SectionTitle>
      <Card>
        <Row label="Supplier" value={order.supplier?.name} />
        <View style={styles.rule} />
        {(order.items || []).map((l) => <Row key={l.productId} label={`${l.qty} × ${l.name}`} value={money(l.totalPaise)} />)}
        <View style={styles.rule} />
        <Row label="Subtotal" value={money(order.totalPaise)} />
        <Row label="Delivery Fee" value="Free" />
        <Row label="Total" value={money(order.totalPaise)} bold />
      </Card>

      <SectionTitle>Payment</SectionTitle>
      <Card>
        <Row label="Method" value={online ? "UPI Payment" : "Cash on Delivery"} />
        <Row label="Status" value={payment} />
        {refund ? <Row label="Refund" value={REFUND[refund.status] || refund.status} /> : null}
      </Card>

      <SectionTitle>Delivery</SectionTitle>
      <Card>
        {order.deliveryAddress ? <Row label="Address" value={order.deliveryAddress} /> : null}
        {order.deliveryInstructions ? <Row label="Instructions" value={order.deliveryInstructions} /> : null}
        {order.rider?.name ? <Row label="Delivery Partner" value={order.rider.name} /> : null}
        {deliveredAt ? <Row label="Delivered" value={formatDateTime(deliveredAt)} /> : null}
      </Card>

      {isDelivered(order.status) ? <RatingCard order={order} onRated={setOrder} /> : null}
      {!isClosed(order.status) ? <Button title="Track Order" onPress={() => navigation.navigate("TrackOrder", { orderId: order.id })} style={{ marginTop: 12 }} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  date: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft },
  rule: { height: 1, backgroundColor: colors.canLine, marginVertical: 8 },
});
