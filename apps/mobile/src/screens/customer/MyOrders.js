import React, { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Alert } from "../../utils/alert";

import { cancelOrder, getMyOrdersPage } from "../../api/customer";
import { errorMessage } from "../../api/client";
import usePolling from "../../hooks/usePolling";
import OrderCard from "../../components/OrderCard";
import { Button, EmptyState, ErrorBanner, Loading, PageTitle, Screen, Segmented } from "../../components/ui";
import { isClosed } from "../../utils/format";

export default function MyOrders({ navigation }) {
  const [orders, setOrders] = useState(null);
  const [tab, setTab] = useState("active");
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [older, setOlder] = useState([]); // pages loaded with "Load More"
  const [more, setMore] = useState({ hasMore: false, cursor: null });
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async () => {
    try {
      // The newest 20 orders refresh automatically; older ones are loaded on request.
      const page = await getMyOrdersPage({ limit: 20 });
      setOrders(page.data);
      setMore((cur) => (older.length ? cur : { hasMore: page.meta.hasMore, cursor: page.meta.nextCursor }));
      setError("");
    } catch (e) {
      setError(errorMessage(e, "Could not load your orders."));
    }
  }, []);
  usePolling(load, 10000);

  const loadMore = async () => {
    if (!more.cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await getMyOrdersPage({ limit: 20, before: more.cursor });
      setOlder((cur) => [...cur, ...page.data]);
      setMore({ hasMore: page.meta.hasMore, cursor: page.meta.nextCursor });
    } catch (e) {
      Alert.alert("Could Not Load More", errorMessage(e));
    } finally {
      setLoadingMore(false);
    }
  };

  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const cancel = (order) =>
    Alert.alert("Cancel Order?", `Order #${order.code} will be cancelled.`, [
      { text: "Keep Order", style: "cancel" },
      {
        text: "Cancel Order",
        style: "destructive",
        onPress: async () => {
          setBusyId(order.id);
          try { await cancelOrder(order.id); await load(); }
          catch (e) { Alert.alert("Could Not Cancel", errorMessage(e)); }
          finally { setBusyId(null); }
        },
      },
    ]);

  if (!orders && !error) return <Screen brand scroll={false}><Loading /></Screen>;

  const everything = [...(orders || []), ...older.filter((o) => !(orders || []).some((n) => n.id === o.id))];
  const list = everything.filter((o) => (tab === "active" ? !isClosed(o.status) : isClosed(o.status)));

  return (
    <Screen brand subtitle="Customer" refreshing={refreshing} onRefresh={refresh}>
      <PageTitle title="Track Your Order" subtitle="Follow Your Delivery Live" />
      <Segmented options={[{ key: "active", label: "Active" }, { key: "past", label: "Past" }]} value={tab} onChange={setTab} style={{ marginBottom: 16 }} />
      <ErrorBanner message={error} onRetry={load} />

      {list.length === 0 ? (
        <EmptyState
          icon="package"
          title={tab === "active" ? "No active orders" : "No past orders"}
          text={tab === "active" ? "Place an order and you can track it here." : "Delivered and cancelled orders show up here."}
          action={tab === "active" ? <Button title="Order Water" onPress={() => navigation.navigate("Products")} /> : null}
        />
      ) : (
        list.map((o) => (
          <OrderCard key={o.id} order={o} subtitle={o.supplier?.name} onPress={() => navigation.navigate("TrackOrder", { orderId: o.id })}>
            <View style={styles.actions}>
              <Button title="Track Order →" variant="soft" small onPress={() => navigation.navigate("TrackOrder", { orderId: o.id })} style={{ flex: 1 }} />
              {["placed", "accepted", "preparing"].includes(o.status) ? (
                <Button title="Cancel" variant="danger" small busy={busyId === o.id} onPress={() => cancel(o)} style={{ flex: 1 }} />
              ) : null}
            </View>
          </OrderCard>
        ))
      )}
      {more.hasMore ? <Button title="Load More Orders" variant="outline" busy={loadingMore} onPress={loadMore} style={{ marginTop: 6 }} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", gap: 10, marginTop: 12 },
});
