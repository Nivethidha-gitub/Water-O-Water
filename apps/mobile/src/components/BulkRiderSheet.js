import React, { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "../i18n";

import { getRiders } from "../api/supplier";
import { errorMessage } from "../api/client";
import { Avatar, Button, EmptyState, ErrorBanner, Loading } from "./ui";
import { colors, fonts, radius } from "../theme/colors";

/*
 * Bottom sheet for choosing one delivery partner for many orders at once.
 * onConfirm(rider) is called with the chosen rider; the caller does the update.
 */
export default function BulkRiderSheet({ visible, count, busy, onClose, onConfirm }) {
  const [riders, setRiders] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!visible) return;
    let active = true;
    setSelected(null);
    setRiders(null);
    setError("");
    getRiders()
      .then((list) => active && setRiders((list || []).filter((r) => r.approvalStatus !== "pending" && r.approvalStatus !== "rejected")))
      .catch((e) => active && setError(errorMessage(e, "Could not load delivery partners.")));
    return () => { active = false; };
  }, [visible]);

  const chosen = (riders || []).find((r) => r.id === selected);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>Choose a Delivery Partner</Text>
        <Text style={styles.sub}>{count === 1 ? "For 1 selected order" : `For ${count} selected orders`}</Text>

        <ErrorBanner message={error} />
        {!riders && !error ? <Loading /> : null}
        {riders && riders.length === 0 ? (
          <EmptyState icon="truck" title="No Delivery Partners Yet" text="Riders create a Rider account in this app and choose your business. They will show up here." />
        ) : null}

        <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
          {(riders || []).map((r) => {
            const on = selected === r.id;
            return (
              <Pressable key={r.id} onPress={() => r.online !== false && setSelected(r.id)} disabled={r.online === false} style={[styles.rider, on && styles.riderOn, r.online === false && { opacity: 0.5 }]} accessibilityRole="radio" accessibilityState={{ checked: on, disabled: r.online === false }}>
                <View style={[styles.radio, on && styles.radioOn]}>{on ? <View style={styles.radioDot} /> : null}</View>
                <Avatar name={r.name} size={40} tone="#fff" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{r.name}</Text>
                  <Text style={styles.meta}>{[r.vehicleNo, r.online === false ? "Offline" : `${r.activeDeliveries} active`].filter(Boolean).join(" · ")}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.actions}>
          <Button title="Cancel" variant="outline" onPress={onClose} disabled={busy} style={{ flex: 1 }} />
          <Button title="Assign Rider" variant="success" disabled={!chosen} busy={busy} onPress={() => onConfirm(chosen)} style={{ flex: 1.4 }} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(7,40,56,.45)" },
  sheet: { backgroundColor: colors.popup, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, paddingBottom: 28 },
  handle: { alignSelf: "center", width: 42, height: 4, borderRadius: 2, backgroundColor: "#B9D8E3", marginBottom: 14 },
  title: { fontFamily: fonts.displayBold, fontSize: 18, color: colors.ink },
  sub: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft, marginTop: 2, marginBottom: 12 },
  rider: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderRadius: radius.lg, padding: 11, marginBottom: 9, borderWidth: 1.5, borderColor: "#E3EEF2" },
  riderOn: { backgroundColor: colors.goodBg, borderColor: colors.good },
  name: { fontFamily: fonts.bodyBold, fontSize: 14.5, color: colors.ink },
  meta: { fontFamily: fonts.body, fontSize: 12, color: colors.inkSoft, marginTop: 1 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.canLine, alignItems: "center", justifyContent: "center" },
  radioOn: { borderColor: colors.good },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: colors.good },
  actions: { flexDirection: "row", gap: 10, marginTop: 12 },
});
