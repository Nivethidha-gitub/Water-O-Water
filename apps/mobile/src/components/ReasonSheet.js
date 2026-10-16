import React, { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { Text } from "../i18n";

import { Button, Field, RadioGroup } from "./ui";
import { colors, fonts } from "../theme/colors";

/*
 * Bottom sheet that asks "why?" before a rejection (an order, or a rider's ID).
 * reasons: [{ key, title }]. The last one ("Other") lets the person type their own.
 * onConfirm(reasonText) is called with the chosen or typed reason.
 */
// Why a supplier turns an order down (the customer sees the chosen reason).
export const ORDER_REASONS = [
  { key: "stock", title: "Out of stock" },
  { key: "area", title: "Outside our delivery area" },
  { key: "busy", title: "Too busy right now" },
  { key: "other", title: "Other reason" },
];

export default function ReasonSheet({ visible, title, subtitle, reasons, confirmLabel = "Reject", busy, onClose, onConfirm }) {
  const [key, setKey] = useState(reasons[0].key);
  const [custom, setCustom] = useState("");
  useEffect(() => { if (visible) { setKey(reasons[0].key); setCustom(""); } }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const other = key === "other";
  const text = other ? custom.trim() : (reasons.find((r) => r.key === key) || {}).title;
  const ready = Boolean(text) && text.length >= 3;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
        <RadioGroup options={reasons} value={key} onChange={setKey} />
        {other ? <Field placeholder="Write the reason" value={custom} onChangeText={setCustom} maxLength={120} style={{ marginTop: 10 }} /> : null}
        <View style={styles.actions}>
          <Button title="Cancel" variant="outline" onPress={onClose} disabled={busy} style={{ flex: 1 }} />
          <Button title={confirmLabel} variant="danger" disabled={!ready} busy={busy} onPress={() => onConfirm(text)} style={{ flex: 1.3 }} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(7,58,78,.45)" },
  sheet: { backgroundColor: colors.popup, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, paddingBottom: 28 },
  handle: { alignSelf: "center", width: 42, height: 4, borderRadius: 2, backgroundColor: "#B9D8E3", marginBottom: 14 },
  title: { fontFamily: fonts.displayBold, fontSize: 18, color: colors.ink },
  sub: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft, marginTop: 2, marginBottom: 12 },
  actions: { flexDirection: "row", gap: 10, marginTop: 14 },
});
