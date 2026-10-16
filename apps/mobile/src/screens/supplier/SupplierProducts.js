import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "../../i18n";
import { Alert } from "../../utils/alert";

import { addProduct, deleteProduct, getProducts, updateProduct } from "../../api/supplier";
import { errorField, errorMessage } from "../../api/client";
import usePolling from "../../hooks/usePolling";
import ProductCard from "../../components/ProductCard";
import { Button, Card, EmptyState, ErrorBanner, Field, Loading, PageTitle, Pill, Screen, SectionTitle } from "../../components/ui";
import { colors, fonts } from "../../theme/colors";

export default function SupplierProducts() {
  const [products, setProducts] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", sku: "", price: "", stock: "" });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setProducts(await getProducts()); setError(""); }
    catch (e) { setError(errorMessage(e, "Could not load products.")); }
  }, []);
  usePolling(load, 30000);
  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const set = (k) => (v) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })); };

  const add = async () => {
    const e = {};
    if (form.name.trim().length < 2) e.name = "Enter a product name";
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/.test(form.sku.trim())) e.sku = "Letters, numbers, - and _ only";
    if (!(Number(form.price) > 0)) e.price = "Enter a price in rupees";
    if (form.stock.trim() !== "" && !/^\d{1,6}$/.test(form.stock.trim())) e.stock = "Whole number, or leave blank";
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await addProduct({ name: form.name.trim(), sku: form.sku.trim(), price: Number(form.price), stock: form.stock.trim() === "" ? null : Number(form.stock) });
      setForm({ name: "", sku: "", price: "", stock: "" });
      await load();
    } catch (err) {
      const field = errorField(err);
      if (field) setErrors({ [field]: errorMessage(err) });
      else Alert.alert("Could Not Add Product", errorMessage(err));
    } finally { setBusy(false); }
  };

  const remove = (p) =>
    Alert.alert("Delete Product?", `${p.nameEn} will no longer be orderable.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try { await deleteProduct(p.id); await load(); }
        catch (err) { Alert.alert("Could Not Delete", errorMessage(err)); }
      } },
    ]);

  if (!products && !error) return <Screen brand scroll={false}><Loading /></Screen>;

  return (
    <Screen brand subtitle="Supplier" keyboard refreshing={refreshing} onRefresh={refresh}>
      <PageTitle title="Products" subtitle="What customers can order from you" />
      <ErrorBanner message={error} onRetry={load} />

      {products && products.length === 0 ? (
        <EmptyState icon="droplet" title="No Products Yet" text="Add your first product below." />
      ) : (
        (products || []).map((p) => (
          <View key={p.id}>
            <ProductCard product={p} right={<Button title="Delete" variant="danger" small onPress={() => remove(p)} />} />
            <StockEditor product={p} onSaved={load} />
          </View>
        ))
      )}

      <SectionTitle>Add a Product</SectionTitle>
      <Card>
        <Field label="Name" value={form.name} onChangeText={set("name")} placeholder="e.g. 20L Can" error={errors.name} />
        <View style={styles.two}>
          <Field label="SKU" value={form.sku} onChangeText={set("sku")} placeholder="CAN20" autoCapitalize="characters" error={errors.sku} style={{ flex: 1 }} />
          <Field label="Price (₹)" value={form.price} onChangeText={set("price")} placeholder="40" keyboardType="decimal-pad" error={errors.price} style={{ flex: 1 }} />
        </View>
        <Field label="Stock (optional)" value={form.stock} onChangeText={set("stock")} placeholder="Cans in stock; blank = not tracked" keyboardType="number-pad" error={errors.stock} />
        <Button title="Add Product" onPress={add} busy={busy} />
      </Card>
    </Screen>
  );
}

// Stock for one product: shows the state, quick -1 / +10, and an exact "Set" (blank + Set stops tracking).
// Customers cannot order more than is in stock; cancelled orders put their cans back automatically.
function StockEditor({ product, onSaved }) {
  const tracked = product.stockQty != null;
  const [text, setText] = useState(tracked ? String(product.stockQty) : "");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setText(product.stockQty != null ? String(product.stockQty) : ""); }, [product.stockQty]);

  const apply = async (changes) => {
    setBusy(true);
    try { await updateProduct(product.id, changes); await onSaved(); }
    catch (err) { Alert.alert("Could Not Update Stock", errorMessage(err)); }
    finally { setBusy(false); }
  };
  const set = () => {
    const value = text.trim();
    if (value !== "" && !/^\d{1,6}$/.test(value)) { Alert.alert("Could Not Update Stock", "Enter a whole number, or leave it blank to stop tracking."); return; }
    apply({ stock: value === "" ? null : Number(value) });
  };

  return (
    <View style={styles.stock}>
      <View style={styles.stockTop}>
        <Text style={styles.stockLabel}>Stock</Text>
        {!tracked ? <Pill text="Not Tracked" tone="info" /> : !product.inStock ? <Pill text="Out of Stock" tone="danger" /> : product.lowStock ? <Pill text="Low Stock" tone="warn" /> : <Pill text="In Stock" tone="good" />}
        {tracked ? (
          <View style={styles.quick}>
            <Button title="−1" variant="outline" small disabled={busy || product.stockQty === 0} onPress={() => apply({ stockDelta: -1 })} />
            <Button title="+10" variant="outline" small disabled={busy} onPress={() => apply({ stockDelta: 10 })} />
          </View>
        ) : null}
      </View>
      <View style={styles.stockSet}>
        <Field value={text} onChangeText={setText} placeholder="Cans in stock" keyboardType="number-pad" style={{ flex: 1, marginBottom: 0 }} />
        <Button title={tracked ? "Set" : "Track"} small busy={busy} onPress={set} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  two: { flexDirection: "row", gap: 12 },
  stock: { marginTop: -4, marginBottom: 12, padding: 12, borderRadius: 14, backgroundColor: colors.can, borderWidth: 1, borderColor: colors.canLine },
  stockTop: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  stockLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.primaryDark },
  quick: { flexDirection: "row", gap: 6, marginLeft: "auto" },
  stockSet: { flexDirection: "row", alignItems: "center", gap: 10 },
});
