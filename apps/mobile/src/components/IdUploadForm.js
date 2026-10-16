import React, { useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { Text } from "../i18n";

import { pickPhoto } from "../utils/photo";
import Icon from "./Icon";
import { Button, Chip, Field } from "./ui";
import { colors, fonts, radius } from "../theme/colors";

export const ID_TYPES = [
  ["aadhaar", "Aadhaar Card"],
  ["driving_licence", "Driving Licence"],
  ["voter_id", "Voter ID"],
  ["pan", "PAN Card"],
  ["passport", "Passport"],
];

/** Checks the ID fields; returns { idType?, idNumber?, idPhoto? } messages (empty when valid). */
export function validateId(v) {
  const e = {};
  if (!v.idType) e.idType = "Choose the type of ID you are uploading";
  if (!/^[A-Za-z0-9]{6,20}$/.test(String(v.idNumber || "").replace(/[\s-]/g, ""))) e.idNumber = "Enter the ID number printed on your ID";
  if (!v.idPhoto) e.idPhoto = "Upload a clear photo of your ID";
  return e;
}

/*
 * One government photo ID: pick the type, type the number, take or choose a photo.
 * Controlled by the parent: value = { idType, idNumber, idPhoto (base64), idUri }.
 */
export default function IdUploadForm({ value, onChange, errors = {} }) {
  const [busy, setBusy] = useState(false);
  const [photoError, setPhotoError] = useState("");

  const take = async (camera) => {
    setBusy(true);
    setPhotoError("");
    try {
      const photo = await pickPhoto({ camera, maxWidth: 1280, quality: 0.5 });
      if (photo) onChange({ idPhoto: photo.base64, idUri: photo.uri });
    } catch (e) {
      setPhotoError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <Text style={styles.label}>Government ID</Text>
      <Text style={styles.hint}>Upload any one of these. Your supplier checks it before you can start deliveries.</Text>
      <View style={styles.chips}>
        {ID_TYPES.map(([key, label]) => <Chip key={key} label={label} active={value.idType === key} onPress={() => onChange({ idType: key })} />)}
      </View>
      {errors.idType ? <Text style={styles.err}>{errors.idType}</Text> : null}
      <Field label="ID Number" value={value.idNumber} onChangeText={(v) => onChange({ idNumber: v })} placeholder="Number printed on your ID" autoCapitalize="characters" autoCorrect={false} error={errors.idNumber} />
      {value.idUri ? <Image source={{ uri: value.idUri }} style={styles.preview} resizeMode="cover" accessibilityLabel="Your ID photo" /> : (
        <View style={styles.empty}><Icon name="credit-card" size={28} color={colors.inkFaint} /><Text style={styles.emptyText}>No ID photo yet</Text></View>
      )}
      <View style={styles.buttons}>
        <Button title={value.idUri ? "Retake Photo" : "Take Photo"} icon="camera" small variant="outline" busy={busy} onPress={() => take(true)} style={{ flex: 1 }} />
        <Button title="Choose From Gallery" icon="image" small variant="outline" disabled={busy} onPress={() => take(false)} style={{ flex: 1.2 }} />
      </View>
      {errors.idPhoto ? <Text style={styles.err}>{errors.idPhoto}</Text> : null}
      {photoError ? <Text style={styles.err}>{photoError}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: fonts.bodySemi, fontSize: 13.5, color: colors.primaryDark },
  hint: { fontFamily: fonts.body, fontSize: 12, color: colors.inkSoft, marginTop: 3, marginBottom: 10, lineHeight: 17 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  preview: { width: "100%", height: 170, borderRadius: radius.md, marginBottom: 10, backgroundColor: colors.can },
  empty: { height: 110, borderRadius: radius.md, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.canLine, alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 10 },
  emptyText: { fontFamily: fonts.body, fontSize: 12.5, color: colors.inkFaint },
  buttons: { flexDirection: "row", gap: 10 },
  err: { fontFamily: fonts.body, fontSize: 12, color: colors.danger, marginTop: 6 },
});
