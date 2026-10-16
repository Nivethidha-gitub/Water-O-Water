import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "../../i18n";

import { getMyOrdersPage, getPaymentHistoryPage } from "../../api/customer";
import { errorMessage } from "../../api/client";
import Icon from "../../components/Icon";
import { Button, Card, EmptyState, ErrorBanner, Loading, Pill, Screen, Segmented, StatusBadge } from "../../components/ui";
import { colors, fonts } from "../../theme/colors";
import { formatDateTime, itemsSummary, money } from "../../utils/format";

// How a payment row reads, and which colour family its pill uses.
const PAYMENT = {
  pay_on_delivery: ["Pay on Delivery", "warn"],
  paid_cash: ["Paid in Cash", "good"],
  paid: ["Paid Online", "good"],
  refund_pending: ["Refund in Progress", "warn"],
  refunded: ["Refunded", "good"],
  cancelled: ["Cancelled", "danger"],
  pending: ["Payment Pending", "warn"],
  expired: ["Link Expired", "danger"],
  failed: ["Payment Failed", "danger"],
};

/* History: every order and every payment (cash or online, with refunds), newest first. */
export default function CustomerHistory({ navigation }) {
  const [tab, setTab] = useState("orders");
  return (
    <Screen title="History" subtitle="Your orders and payments" onBack={() => navigation.goBack()}>
      <Segmented options={[{ key: "orders", label: "Orders" }, { key: "payments", label: "Payments" }]} value={tab} onChange={setTab} style={{ marginBottom: 14 }} />
      {tab === "orders" ? <HistoryList key="orders" fetchPage={getMyOrdersPage} render={(o) => <OrderRow order={o} navigation={navigation} />} empty={["package", "No Orders Yet", "Your orders will be listed here with their receipts."]} /> : null}
      {tab === "payments" ? <HistoryList key="payments" fetchPage={getPaymentHistoryPage} render={(p) => <PaymentRow payment={p} navigation={navigation} />} empty={["credit-card", "No Payments Yet", "Cash and online payments will be listed here."]} /> : null}
    </Screen>
  );
}

// Loads 20 rows at a time; "Load More" fetches the next page.
function HistoryList({ fetchPage, render, empty }) {
  const [rows, setRows] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);

  const first = useCallback(async () => {
    try {
      const page = await fetchPage({ limit: 20 });
      setRows(page.data);
      setHasMore(page.meta.hasMore);
      setCursor(page.meta.nextCursor);
      setError("");
    } catch (e) {
      setError(errorMessage(e, "Could not load your history."));
    }
  }, [fetchPage]);
  useEffect(() => { first(); }, [first]);

  const more = async () => {
    setLoadingMore(true);
    try {
      const page = await fetchPage({ limit: 20, before: cursor });
      setRows((cur) => [...cur, ...page.data]);
      setHasMore(page.meta.hasMore);
      setCursor(page.meta.nextCursor);
    } catch (e) {
      setError(errorMessage(e, "Could not load more."));
    } finally {
      setLoadingMore(false);
    }
  };

  if (!rows && !error) return <Loading />;
  return (
    <View>
      <ErrorBanner message={error} onRetry={first} />
      {rows && rows.length === 0 ? <EmptyState icon={empty[0]} title={empty[1]} text={empty[2]} /> : null}
      {(rows || []).map((r) => <React.Fragment key={r.id}>{render(r)}</React.Fragment>)}
      {hasMore ? <Button title="Load More" variant="outline" busy={loadingMore} onPress={more} /> : null}
    </View>
  );
}

function OrderRow({ order, navigation }) {
  return (
    <Pressable onPress={() => navigation.navigate("Receipt", { orderId: order.id })} accessibilityRole="button">
      <Card style={styles.row}>
        <View style={styles.top}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Order #{order.code}</Text>
            <Text style={styles.meta}>{formatDateTime(order.createdAt)}</Text>
          </View>
          <StatusBadge status={order.status} />
        </View>
        <Text style={styles.items} numberOfLines={1}>{itemsSummary(order)}</Text>
        <View style={styles.foot}>
          <Text style={styles.amount}>{money(order.totalPaise)}</Text>
          <View style={styles.link}><Text style={styles.linkText}>Receipt</Text><Icon name="chevron-right" size={16} /></View>
        </View>
      </Card>
    </Pressable>
  );
}

function PaymentRow({ payment, navigation }) {
  const [label, tone] = PAYMENT[payment.status] || [payment.status, "info"];
  const body = (
    <Card style={styles.row}>
      <View style={styles.top}>
        <View style={styles.methodIcon}><Icon name={payment.method === "UPI" ? "smartphone" : "dollar-sign"} size={18} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{payment.code ? `Order #${payment.code}` : "Online Payment"}</Text>
          <Text style={styles.meta}>{formatDateTime(payment.at)} · {payment.method === "UPI" ? "UPI" : "Cash on Delivery"}</Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 6 }}>
          <Text style={styles.amount}>{money(payment.amountPaise)}</Text>
          <Pill text={label} tone={tone} />
        </View>
      </View>
    </Card>
  );
  return payment.orderId ? <Pressable onPress={() => navigation.navigate("Receipt", { orderId: payment.orderId })} accessibilityRole="button">{body}</Pressable> : body;
}

const styles = StyleSheet.create({
  row: { marginBottom: 10 },
  top: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { fontFamily: fonts.bodyBold, fontSize: 14.5, color: colors.ink },
  meta: { fontFamily: fonts.body, fontSize: 12, color: colors.inkSoft, marginTop: 2 },
  items: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft, marginTop: 10 },
  foot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 },
  amount: { fontFamily: fonts.displayBold, fontSize: 16, color: colors.primaryDark },
  link: { flexDirection: "row", alignItems: "center", gap: 2 },
  linkText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.primary },
  methodIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.can, alignItems: "center", justifyContent: "center" },
});
