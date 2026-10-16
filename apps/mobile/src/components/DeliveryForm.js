import React, { useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { Text } from "../i18n";

import { pickPhoto } from "../utils/photo";
import { Button, Chip, Field, Stepper } from "./ui";
import { colors, fonts, radius } from "../theme/colors";
import { money, totalQty } from "../utils/format";

/*
 * "Mark Delivered": how many full cans were handed over, how many empties were
 * collected, and what was paid. Only the assigned rider uses this: the supplier cannot complete a delivery.
 */
export default function DeliveryForm({ order, onSubmit, busy }) {
  // The rider must prove the delivery with the customer's 4-digit code (or a photo if the customer is not there).
  const needsProof = Boolean(order?.proofRequired);
  const [proofMode, setProofMode] = useState("code");
  const [code, setCode] = useState("");
  const [photo, setPhoto] = useState(null); // { uri, base64 }
  const [note, setNote] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [proofError, setProofError] = useState("");
  const qty = totalQty(order);
  const [fullOut, setFullOut] = useState(qty);
  const [emptyIn, setEmptyIn] = useState(qty);
  const [mode, setMode] = useState("cash");
  const [amount, setAmount] = useState(String((Number(order?.totalPaise) || 0) / 100));
  const [error, setError] = useState("");

  const submit = () => {
    const rupees = Number(String(amount).replace(/[^\d.]/g, ""));
    if (!Number.isFinite(rupees) || rupees < 0) {
      setError("Enter a valid amount (0 if nothing was collected).");
      return;
    }
    setError("");
    const proof = {};
    if (needsProof) {
      if (proofMode === "code") {
        if (!/^\d{4}$/.test(code.trim())) { setProofError("Enter the 4-digit code shown on the customer's screen."); return; }
        proof.deliveryCode = code.trim();
      } else {
        if (!photo) { setProofError("Take a photo of the delivered cans."); return; }
        proof.proofPhoto = photo.base64;
      }
      if (note.trim()) proof.proofNote = note.trim();
    }
    setProofError("");
    onSubmit({
      fullOut,
      emptyIn,
      paymentMode: mode,
      amountCollectedPaise: Math.round(rupees * 100),
      ...proof,
    });
  };

  const takePhoto = async () => {
    setPhotoBusy(true);
    setProofError("");
    try {
      const p = await pickPhoto({ camera: true, maxWidth: 1024, quality: 0.4 });
      if (p) setPhoto(p);
    } catch (e) {
      setProofError(e.message);
    } finally {
      setPhotoBusy(false);
    }
  };

  return (
    <View style={styles.box}>
      <Text style={styles.title}>Complete Delivery</Text>

      <View style={styles.line}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Full Cans Delivered</Text>
          <Text style={styles.hint}>Ordered: {qty}</Text>
        </View>
        <Stepper value={fullOut} onChange={setFullOut} />
      </View>

      <View style={styles.line}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Empty Cans Collected</Text>
          <Text style={styles.hint}>Taken back from the customer</Text>
        </View>
        <Stepper value={emptyIn} onChange={setEmptyIn} />
      </View>

      <Text style={[styles.label, { marginTop: 14, marginBottom: 8 }]}>Payment</Text>
      <View style={{ flexDirection: "row" }}>
        <Chip label="Cash" active={mode === "cash"} onPress={() => setMode("cash")} />
        <Chip label="UPI" active={mode === "upi"} onPress={() => setMode("upi")} />
      </View>

      <Field
        label={`Amount collected (bill ${money(order?.totalPaise)})`}
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        error={error}
        style={{ marginTop: 14 }}
        placeholder="0"
      />

      {needsProof ? (
        <View style={{ marginTop: 14 }}>
          <Text style={[styles.label, { marginBottom: 8 }]}>Proof of Delivery</Text>
          <View style={{ flexDirection: "row" }}>
            <Chip label="Customer's Code" active={proofMode === "code"} onPress={() => setProofMode("code")} />
            <Chip label="Photo" active={proofMode === "photo"} onPress={() => setProofMode("photo")} />
          </View>
          {proofMode === "code" ? (
            <Field label="Delivery Code" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={4} placeholder="4 digits" style={{ marginTop: 12 }} />
          ) : (
            <View style={{ marginTop: 12 }}>
              {photo ? <Image source={{ uri: photo.uri }} style={styles.photo} resizeMode="cover" accessibilityLabel="Delivery photo" /> : null}
              <Button title={photo ? "Retake Photo" : "Take Photo"} icon="camera" variant="outline" small busy={photoBusy} onPress={takePhoto} />
            </View>
          )}
          <Field label="Note (optional)" value={note} onChangeText={setNote} maxLength={200} placeholder="e.g. Left with security" style={{ marginTop: 12 }} />
          {proofError ? <Text style={styles.proofError}>{proofError}</Text> : null}
        </View>
      ) : null}

      <Button title="Mark as Delivered" variant="success" icon="check" onPress={submit} busy={busy} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#E3EEF2" },
  title: { fontFamily: fonts.display, fontSize: 16, color: colors.primaryDark, marginBottom: 6 },
  line: { flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 12 },
  label: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.ink },
  photo: { width: "100%", height: 170, borderRadius: radius.md, marginBottom: 10, backgroundColor: colors.can },
  proofError: { fontFamily: fonts.body, fontSize: 12.5, color: colors.danger, marginBottom: 8 },
  hint: { fontFamily: fonts.body, fontSize: 12, color: colors.inkSoft, marginTop: 1 },
});
