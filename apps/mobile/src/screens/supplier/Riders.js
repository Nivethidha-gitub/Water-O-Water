import React, { useCallback, useState } from "react";
import { Image, Modal, Pressable, StyleSheet, View } from "react-native";
import { Text } from "../../i18n";
import { Alert } from "../../utils/alert";

import { approveRider, getRiderDocument, getRiders, rejectRider } from "../../api/supplier";
import { errorMessage } from "../../api/client";
import usePolling from "../../hooks/usePolling";
import ReasonSheet from "../../components/ReasonSheet";
import { Avatar, Button, Card, EmptyState, ErrorBanner, Loading, PageTitle, Pill, Screen, SectionTitle } from "../../components/ui";
import { colors, fonts, radius } from "../../theme/colors";
import { callPhone, formatDateTime, prettyPhone } from "../../utils/format";

const ID_REASONS = [
  { key: "blurry", title: "ID photo is not clear" },
  { key: "mismatch", title: "ID details do not match" },
  { key: "type", title: "This ID type is not accepted" },
  { key: "other", title: "Other reason" },
];

/* Delivery partners. New riders must be approved here (after checking the ID they uploaded) before they can take deliveries. */
export default function Riders() {
  const [riders, setRiders] = useState(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [viewing, setViewing] = useState(null); // { rider, doc, loading, error }
  const [rejecting, setRejecting] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try { setRiders(await getRiders()); setError(""); }
    catch (e) { setError(errorMessage(e, "Could not load delivery partners.")); }
  }, []);
  usePolling(load, 15000);
  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const openId = async (rider) => {
    setViewing({ rider, doc: null, loading: true, error: "" });
    try { setViewing({ rider, doc: await getRiderDocument(rider.id), loading: false, error: "" }); }
    catch (e) { setViewing({ rider, doc: null, loading: false, error: errorMessage(e, "Could not open the ID.") }); }
  };

  const approve = async (rider) => {
    setBusyId(rider.id);
    try { await approveRider(rider.id); setViewing(null); await load(); }
    catch (e) { Alert.alert("Could Not Approve", errorMessage(e)); }
    finally { setBusyId(null); }
  };
  const confirmReject = async (reason) => {
    const rider = rejecting;
    setRejecting(null);
    setBusyId(rider.id);
    try { await rejectRider(rider.id, reason); setViewing(null); await load(); }
    catch (e) { Alert.alert("Could Not Reject", errorMessage(e)); }
    finally { setBusyId(null); }
  };

  if (!riders && !error) return <Screen brand scroll={false}><Loading /></Screen>;

  const pending = (riders || []).filter((r) => r.approvalStatus === "pending");
  const others = (riders || []).filter((r) => r.approvalStatus !== "pending");

  return (
    <Screen brand subtitle="Supplier" refreshing={refreshing} onRefresh={refresh}>
      <PageTitle title="Delivery Partners" subtitle="Riders who deliver for your business" />
      <ErrorBanner message={error} onRetry={load} />

      {pending.length ? (
        <>
          <SectionTitle>{`Waiting for Your Approval (${pending.length})`}</SectionTitle>
          {pending.map((r) => (
            <Card key={r.id} style={styles.pending}>
              <View style={styles.row}>
                <Avatar name={r.name} size={46} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{r.name}</Text>
                  <Text style={styles.meta}>{[r.vehicleNo, r.phone && prettyPhone(r.phone)].filter(Boolean).join("  ")}</Text>
                  <Text style={styles.meta}>{[r.idTypeLabel, r.idLast4 && `•••• ${r.idLast4}`, r.submittedAt && formatDateTime(r.submittedAt)].filter(Boolean).join(" · ")}</Text>
                </View>
              </View>
              <View style={styles.actions}>
                <Button title="View ID" icon="eye" variant="outline" small onPress={() => openId(r)} style={{ flex: 1 }} />
                <Button title="Approve" variant="success" small busy={busyId === r.id} onPress={() => approve(r)} style={{ flex: 1 }} />
                <Button title="Reject" variant="danger" small disabled={busyId === r.id} onPress={() => setRejecting(r)} style={{ flex: 1 }} />
              </View>
            </Card>
          ))}
          <SectionTitle>Your Delivery Partners</SectionTitle>
        </>
      ) : null}

      {riders && riders.length === 0 ? (
        <EmptyState icon="truck" title="No Delivery Partners Yet" text="Ask your riders to open the app, choose Rider and sign up with your business name selected." />
      ) : (
        others.map((r) => (
          <Card key={r.id}>
            <View style={styles.row}>
              <Avatar name={r.name} size={48} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{r.name}</Text>
                <Text style={styles.meta}>{[r.vehicleNo, r.phone && prettyPhone(r.phone)].filter(Boolean).join("  ")}</Text>
                <View style={styles.pills}>
                  {r.approvalStatus === "rejected" ? (
                    <Pill text="ID Rejected" tone="danger" />
                  ) : (
                    <>
                      <Pill text={r.online ? "Online" : "Offline"} tone={r.online ? "good" : "danger"} />
                      <Pill text={`${r.activeDeliveries} active`} tone={r.activeDeliveries ? "warn" : "info"} />
                      <Pill text={`${r.completedDeliveries} delivered`} tone="good" />
                    </>
                  )}
                </View>
                {r.approvalStatus === "rejected" && r.approvalNote ? <Text style={styles.meta}>{r.approvalNote} · waiting for a new upload</Text> : null}
              </View>
              {r.phone ? <Button title="Call" icon="phone" small variant="outline" onPress={() => callPhone(r.phone)} /> : null}
            </View>
          </Card>
        ))
      )}

      {/* The ID photo, with the same approve / reject choices */}
      <Modal visible={!!viewing} transparent animationType="fade" onRequestClose={() => setViewing(null)}>
        <View style={styles.modalBack}>
          <View style={styles.modalCard}>
            <Text style={styles.name}>{viewing ? viewing.rider.name : ""}</Text>
            {viewing && viewing.loading ? <Loading /> : null}
            {viewing && viewing.error ? <ErrorBanner message={viewing.error} /> : null}
            {viewing && viewing.doc ? (
              <>
                <Text style={styles.meta}>{viewing.doc.idTypeLabel} · •••• {viewing.doc.idLast4}</Text>
                <Image source={{ uri: viewing.doc.photo }} style={styles.idImage} resizeMode="contain" accessibilityLabel="Rider ID photo" />
              </>
            ) : null}
            <View style={styles.actions}>
              <Button title="Close" variant="outline" small onPress={() => setViewing(null)} style={{ flex: 1 }} />
              {viewing && viewing.doc && viewing.rider.approvalStatus === "pending" ? (
                <>
                  <Button title="Approve" variant="success" small busy={busyId === viewing.rider.id} onPress={() => approve(viewing.rider)} style={{ flex: 1 }} />
                  <Button title="Reject" variant="danger" small onPress={() => { const r = viewing.rider; setViewing(null); setRejecting(r); }} style={{ flex: 1 }} />
                </>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>

      <ReasonSheet
        visible={!!rejecting}
        title="Reject This ID?"
        subtitle={rejecting ? `${rejecting.name} is told why and can upload again.` : ""}
        reasons={ID_REASONS}
        onClose={() => setRejecting(null)}
        onConfirm={confirmReject}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  pending: { borderColor: colors.accent, borderWidth: 1.5 },
  name: { fontFamily: fonts.display, fontSize: 16, color: colors.primaryDark },
  meta: { fontFamily: fonts.body, fontSize: 12.5, color: colors.inkSoft, marginTop: 2 },
  pills: { flexDirection: "row", gap: 6, marginTop: 8 },
  actions: { flexDirection: "row", gap: 8, marginTop: 14 },
  modalBack: { flex: 1, backgroundColor: "rgba(7,58,78,.6)", justifyContent: "center", padding: 18 },
  modalCard: { backgroundColor: colors.popup, borderRadius: radius.xl, padding: 16, borderWidth: 1, borderColor: colors.popupLine },
  idImage: { width: "100%", height: 300, marginTop: 10, borderRadius: radius.md, backgroundColor: colors.can },
});
