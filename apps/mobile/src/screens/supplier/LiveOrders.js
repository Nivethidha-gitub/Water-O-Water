import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text, t } from "../../i18n";
import { Alert } from "../../utils/alert";

import { acceptOrder, bulkUpdateOrders, getOrders, rejectOrder } from "../../api/supplier";
import { errorMessage } from "../../api/client";
import usePolling from "../../hooks/usePolling";
import OrderCard from "../../components/OrderCard";
import BulkRiderSheet from "../../components/BulkRiderSheet";
import ReasonSheet, { ORDER_REASONS } from "../../components/ReasonSheet";
import { Button, EmptyState, ErrorBanner, Loading, PageTitle, Screen, Segmented } from "../../components/ui";
import { colors, fonts, radius } from "../../theme/colors";
import { isInProgress } from "../../utils/format";

/*
 * "4. Live Orders": New / Accepted / All.
 *  - New orders: Accept or Reject one by one, or select several and accept them together.
 *  - Accepted orders: select several, then assign one delivery partner to all of
 *    them, start preparing them, or mark them ready for pickup (bulk update).
 *    The supplier never starts or completes a delivery: the assigned rider does that.
 */
export default function LiveOrders({ navigation }) {
  const [orders, setOrders] = useState(null);
  const [tab, setTab] = useState("new");
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState([]); // order ids
  const [bulkBusy, setBulkBusy] = useState("");
  const [sheet, setSheet] = useState(false);
  const [notice, setNotice] = useState("");
  const [rejecting, setRejecting] = useState(null); // the order being turned down
  const noticeTimer = useRef(null);

  const load = useCallback(async () => {
    try { setOrders(await getOrders()); setError(""); }
    catch (e) { setError(errorMessage(e, "Could not load orders.")); }
  }, []);
  usePolling(load, 8000);
  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };
  useEffect(() => () => clearTimeout(noticeTimer.current), []);

  const all = orders || [];
  const fresh = all.filter((o) => o.status === "placed");
  const accepted = all.filter((o) => isInProgress(o.status));
  const shown = tab === "new" ? fresh : tab === "accepted" ? accepted : all;

  // Only orders the chosen bulk action can still change may be selected.
  const canSelect = (o) => (tab === "new" ? o.status === "placed" : ["accepted", "preparing", "ready_for_pickup"].includes(o.status));
  const selectable = tab === "all" ? [] : shown.filter(canSelect);
  const selectedOrders = selectable.filter((o) => selected.includes(o.id));
  const preparable = selectedOrders.filter((o) => o.status === "accepted").length;
  const readyable = selectedOrders.filter((o) => o.status === "preparing").length;

  const changeTab = (next) => { setTab(next); setSelecting(false); setSelected([]); };
  const stopSelecting = () => { setSelecting(false); setSelected([]); };
  const toggle = (id) => setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const allPicked = selectable.length > 0 && selectedOrders.length === selectable.length;

  const showNotice = (text) => {
    setNotice(text);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(""), 5000);
  };

  const act = async (order, fn, failTitle) => {
    setBusyId(order.id);
    try {
      await fn(order.id);
      await load();
      if (fn === acceptOrder) navigation.navigate("SupplierOrder", { orderId: order.id });
    }
    catch (e) { Alert.alert(failTitle, errorMessage(e)); await load(); }
    finally { setBusyId(null); }
  };

  // Rejecting asks for a reason; the customer is notified straight away and sees it.
  const reject = (order) => setRejecting(order);
  const confirmReject = async (reason) => {
    const order = rejecting;
    setRejecting(null);
    await act(order, (id) => rejectOrder(id, reason), "Could Not Reject");
  };

  // ---- bulk update ----------------------------------------------------------
  const runBulk = async (action, ids, okText, riderId) => {
    setBulkBusy(action);
    try {
      const res = await bulkUpdateOrders({ action, orderIds: ids, riderId });
      const failed = res.results.filter((r) => !r.ok);
      if (res.succeeded) showNotice(okText(res.succeeded));
      // keep only the orders that failed selected, so they can be retried
      setSelected(failed.map((f) => f.orderId));
      if (!failed.length) setSelecting(false);
      if (failed.length) {
        const lines = failed.slice(0, 6).map((f) => `#${f.code || f.orderId}: ${t(f.message)}`);
        if (failed.length > 6) lines.push(t(`and ${failed.length - 6} more`));
        Alert.alert("Some Orders Could Not Be Updated", lines.join("\n"));
      }
      setSheet(false);
      await load();
    } catch (e) {
      Alert.alert("Bulk Update Failed", errorMessage(e, "Could not update the selected orders."));
    } finally {
      setBulkBusy("");
    }
  };

  const acceptSelected = () =>
    runBulk("accept", selectedOrders.map((o) => o.id), (n) => (n === 1 ? "1 order accepted" : `${n} orders accepted`));
  const prepareSelected = () =>
    runBulk("prepare", selectedOrders.filter((o) => o.status === "accepted").map((o) => o.id), (n) => (n === 1 ? "1 order is being prepared" : `${n} orders are being prepared`));
  const readySelected = () =>
    runBulk("ready", selectedOrders.filter((o) => o.status === "preparing").map((o) => o.id), (n) => (n === 1 ? "1 order is ready for pickup" : `${n} orders are ready for pickup`));
  const assignSelected = (rider) =>
    runBulk("assign-rider", selectedOrders.map((o) => o.id), (n) => (n === 1 ? `1 order assigned to ${rider.name}` : `${n} orders assigned to ${rider.name}`), rider.id);

  if (!orders && !error) return <Screen brand scroll={false}><Loading /></Screen>;

  const bulkBar = selecting && selectedOrders.length > 0 ? (
    <View>
      <Text style={styles.barCount}>{selectedOrders.length === 1 ? "1 order selected" : `${selectedOrders.length} orders selected`}</Text>
      {tab === "new" ? (
        <Button title="Accept Selected" variant="success" busy={bulkBusy === "accept"} onPress={acceptSelected} />
      ) : (
        <View>
          <Button title="Assign Rider" variant="dark" disabled={!!bulkBusy} onPress={() => setSheet(true)} />
          <View style={[styles.barActions, { marginTop: 8 }]}>
            <Button title={`Start Preparing (${preparable})`} variant="success" disabled={!preparable || (!!bulkBusy && bulkBusy !== "prepare")} busy={bulkBusy === "prepare"} onPress={prepareSelected} style={{ flex: 1 }} />
            <Button title={`Mark Ready (${readyable})`} variant="success" disabled={!readyable || (!!bulkBusy && bulkBusy !== "ready")} busy={bulkBusy === "ready"} onPress={readySelected} style={{ flex: 1 }} />
          </View>
        </View>
      )}
    </View>
  ) : null;

  return (
    <>
      <Screen brand subtitle="Supplier" refreshing={refreshing} onRefresh={refresh} footer={bulkBar}>
        <PageTitle title="Live Orders" subtitle="Orders placed with you appear here" />
        <Segmented
          options={[
            { key: "new", label: `New (${fresh.length})` },
            { key: "accepted", label: `Accepted (${accepted.length})` },
            { key: "all", label: "All" },
          ]}
          value={tab}
          onChange={changeTab}
          style={{ marginBottom: 12 }}
        />
        <ErrorBanner message={error} onRetry={load} />
        {notice ? <View style={styles.notice}><Text style={styles.noticeText}>✓ {notice}</Text></View> : null}

        {selectable.length > 0 ? (
          <View style={styles.selectRow}>
            {selecting ? (
              <>
                <Pressable onPress={() => setSelected(allPicked ? [] : selectable.map((o) => o.id))} hitSlop={8}>
                  <Text style={styles.link}>{allPicked ? "Clear Selection" : `Select All (${selectable.length})`}</Text>
                </Pressable>
                <Pressable onPress={stopSelecting} hitSlop={8}><Text style={styles.linkMuted}>Cancel</Text></Pressable>
              </>
            ) : (
              <>
                <Text style={styles.hint}>{tab === "new" ? "Accept many orders at once" : "Assign riders and update preparation in bulk"}</Text>
                <Pressable onPress={() => setSelecting(true)} style={styles.selectBtn} hitSlop={8}><Text style={styles.selectBtnText}>Select Orders</Text></Pressable>
              </>
            )}
          </View>
        ) : null}

        {shown.length === 0 ? (
          <EmptyState
            icon={tab === "new" ? "bell" : "package"}
            title={tab === "new" ? "No New Orders" : "Nothing Here Yet"}
            text={tab === "new" ? "New orders show up here within seconds." : "Orders will appear as they move along."}
          />
        ) : (
          shown.map((o) => {
            const pickable = selecting && canSelect(o);
            const on = selected.includes(o.id);
            const card = (
              <OrderCard
                supplierView
                order={o}
                subtitle={o.customer?.name}
                onPress={() => (pickable ? toggle(o.id) : navigation.navigate("SupplierOrder", { orderId: o.id }))}
              >
                {selecting ? null : o.status === "placed" ? (
                  <View style={styles.actions}>
                    <Button title="Accept" variant="success" small busy={busyId === o.id} onPress={() => act(o, acceptOrder, "Could Not Accept")} style={{ flex: 1 }} />
                    <Button title="Reject" variant="danger" small disabled={busyId === o.id} onPress={() => reject(o)} style={{ flex: 1 }} />
                  </View>
                ) : isInProgress(o.status) ? (
                  <View style={styles.actions}>
                    <Button
                      title={o.rider ? `Rider: ${o.rider.name}` : "Assign Rider"}
                      variant={o.rider ? "soft" : "dark"}
                      small
                      onPress={() => navigation.navigate("SupplierOrder", { orderId: o.id })}
                      style={{ flex: 1 }}
                    />
                  </View>
                ) : null}
              </OrderCard>
            );
            if (!selecting || tab === "all") return <React.Fragment key={o.id}>{card}</React.Fragment>;
            return (
              <View key={o.id} style={styles.pickRow}>
                {pickable ? (
                  <Pressable onPress={() => toggle(o.id)} hitSlop={8} accessibilityRole="checkbox" accessibilityState={{ checked: on }} style={[styles.check, on && styles.checkOn]}>
                    {on ? <Text style={styles.checkMark}>✓</Text> : null}
                  </Pressable>
                ) : <View style={styles.checkSpacer} />}
                <View style={[{ flex: 1 }, !pickable && { opacity: 0.55 }]}>{card}</View>
              </View>
            );
          })
        )}
      </Screen>

      <ReasonSheet
        visible={!!rejecting}
        title="Reject This Order?"
        subtitle={rejecting ? `The customer is told straight away. Order #${rejecting.code}` : ""}
        reasons={ORDER_REASONS}
        onClose={() => setRejecting(null)}
        onConfirm={confirmReject}
      />
      <BulkRiderSheet
        visible={sheet}
        count={selectedOrders.length}
        busy={bulkBusy === "assign-rider"}
        onClose={() => !bulkBusy && setSheet(false)}
        onConfirm={assignSelected}
      />
    </>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", gap: 10, marginTop: 12 },
  selectRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 10 },
  hint: { flex: 1, fontFamily: fonts.body, fontSize: 12.5, color: colors.inkSoft },
  selectBtn: { backgroundColor: colors.can, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: colors.canLine },
  selectBtnText: { fontFamily: fonts.bodySemi, fontSize: 12.5, color: colors.primaryDark },
  link: { fontFamily: fonts.bodySemi, fontSize: 13.5, color: colors.primary },
  linkMuted: { fontFamily: fonts.bodySemi, fontSize: 13.5, color: colors.inkSoft },
  pickRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  check: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: colors.canLine, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkSpacer: { width: 26, marginBottom: 12 },
  checkMark: { color: "#fff", fontFamily: fonts.bodyBold, fontSize: 15, lineHeight: 18 },
  barCount: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.primaryDark, marginBottom: 10, textAlign: "center" },
  barActions: { flexDirection: "row", gap: 10 },
  notice: { backgroundColor: colors.goodBg, borderRadius: radius.md, padding: 11, marginBottom: 12, borderWidth: 1, borderColor: colors.canLine },
  noticeText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.primaryDark },
});
