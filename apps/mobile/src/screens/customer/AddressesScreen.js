import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "../../i18n";
import { Alert } from "../../utils/alert";

import { addAddress, deleteAddress, getAddresses, setDefaultAddress, updateAddress } from "../../api/customer";
import { errorMessage } from "../../api/client";
import Icon from "../../components/Icon";
import { Button, Card, Chip, ErrorBanner, Field, Loading, Pill, Screen } from "../../components/ui";
import { colors, fonts } from "../../theme/colors";

const LABELS = ["Home", "Work", "Other"];
const ICON = { Home: "home", Work: "briefcase", Other: "map-pin" };

/* Saved delivery addresses: add, edit, delete, choose the default, and standing delivery instructions. */
export default function AddressesScreen({ navigation }) {
  const [list, setList] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState(null); // null = hidden; { id?, label, line, instructions }
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState("");

  const load = useCallback(async () => {
    try { setList(await getAddresses()); setError(""); }
    catch (e) { setError(errorMessage(e, "Could not load your addresses.")); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    const line = form.line.trim();
    if (line.length < 8) { setFieldError("Enter the full address (street, area, city)"); return; }
    setBusy(true);
    setFieldError("");
    try {
      const body = { label: form.label, line, instructions: form.instructions.trim() };
      if (form.id) await updateAddress(form.id, body);
      else await addAddress({ ...body, makeDefault: !list || list.length === 0 });
      setForm(null);
      await load();
    } catch (e) {
      setFieldError(errorMessage(e, "Could not save this address."));
    } finally {
      setBusy(false);
    }
  };

  const makeDefault = async (a) => {
    try { setList(await setDefaultAddress(a.id)); } catch (e) { Alert.alert("Could Not Update", errorMessage(e)); }
  };

  const remove = (a) =>
    Alert.alert("Delete Address?", `${a.label}: ${a.line}`, [
      { text: "Keep", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { try { setList(await deleteAddress(a.id)); } catch (e) { Alert.alert("Could Not Delete", errorMessage(e)); } } },
    ]);

  if (!list && !error) return <Screen title="Saved Addresses" onBack={() => navigation.goBack()} scroll={false}><Loading /></Screen>;

  return (
    <Screen title="Saved Addresses" subtitle="Where should we deliver?" onBack={() => navigation.goBack()}>
      <ErrorBanner message={error} onRetry={load} />
      {(list || []).map((a) => (
        <Card key={a.id} style={styles.card}>
          <View style={styles.top}>
            <View style={styles.icon}><Icon name={ICON[a.label] || "map-pin"} size={18} /></View>
            <View style={{ flex: 1 }}>
              <View style={styles.titleRow}><Text style={styles.label}>{a.label}</Text>{a.isDefault ? <Pill text="Default" tone="good" /> : null}</View>
              <Text style={styles.line}>{a.line}</Text>
              {a.instructions ? <Text style={styles.note}>Note: {a.instructions}</Text> : null}
            </View>
          </View>
          <View style={styles.actions}>
            {!a.isDefault ? <Pressable onPress={() => makeDefault(a)} hitSlop={8}><Text style={styles.link}>Make Default</Text></Pressable> : <View />}
            <View style={styles.right}>
              <Pressable onPress={() => { setFieldError(""); setForm({ id: a.id, label: a.label, line: a.line, instructions: a.instructions || "" }); }} hitSlop={8}><Text style={styles.link}>Edit</Text></Pressable>
              {list.length > 1 ? <Pressable onPress={() => remove(a)} hitSlop={8}><Text style={styles.danger}>Delete</Text></Pressable> : null}
            </View>
          </View>
        </Card>
      ))}

      {form ? (
        <Card style={styles.card}>
          <Text style={styles.formTitle}>{form.id ? "Edit Address" : "New Address"}</Text>
          <View style={styles.chips}>
            {LABELS.map((l) => <Chip key={l} label={l} active={form.label === l} onPress={() => setForm({ ...form, label: l })} />)}
          </View>
          <Field label="Full Address" placeholder="House no, street, area, city, pincode" value={form.line} onChangeText={(v) => setForm({ ...form, line: v })} multiline maxLength={200} />
          <Field label="Delivery Instructions" placeholder="e.g. Call at the gate, 2nd floor" value={form.instructions} onChangeText={(v) => setForm({ ...form, instructions: v })} maxLength={200} />
          <ErrorBanner message={fieldError} />
          <View style={styles.formActions}>
            <Button title="Cancel" variant="outline" onPress={() => setForm(null)} disabled={busy} style={{ flex: 1 }} />
            <Button title="Save Address" busy={busy} onPress={save} style={{ flex: 1.3 }} />
          </View>
        </Card>
      ) : (
        <Button title="Add New Address" icon="plus" variant="outline" onPress={() => { setFieldError(""); setForm({ label: "Home", line: "", instructions: "" }); }} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 12 },
  top: { flexDirection: "row", gap: 12 },
  icon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.can, alignItems: "center", justifyContent: "center" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  label: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  line: { fontFamily: fonts.body, fontSize: 13.5, color: colors.inkSoft, marginTop: 3, lineHeight: 19 },
  note: { fontFamily: fonts.body, fontSize: 12, color: colors.primary, marginTop: 4 },
  actions: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.canLine },
  right: { flexDirection: "row", gap: 18 },
  link: { fontFamily: fonts.bodySemi, fontSize: 13.5, color: colors.primary },
  danger: { fontFamily: fonts.bodySemi, fontSize: 13.5, color: colors.danger },
  formTitle: { fontFamily: fonts.displayBold, fontSize: 16, color: colors.primaryDark, marginBottom: 10 },
  chips: { flexDirection: "row", gap: 8, marginBottom: 12 },
  formActions: { flexDirection: "row", gap: 10, marginTop: 6 },
});
