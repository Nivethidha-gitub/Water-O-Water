import React, { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "../../i18n";
import { Alert } from "../../utils/alert";
import { getProducts, getSuppliers } from "../../api/customer";
import { errorMessage } from "../../api/client";
import { useCart } from "../../context/CartContext";
import ProductCard from "../../components/ProductCard";
import { Button, EmptyState, ErrorBanner, Loading, Screen } from "../../components/ui";
import { colors, fonts, radius, shadow } from "../../theme/colors";
import { money } from "../../utils/format";

/* Supplier selection and product ordering, matching the supplied prototype flow. */
export default function ProductsScreen({ route, navigation }) {
  const cart = useCart();
  const [suppliers, setSuppliers] = useState(null);
  const [supplierId, setSupplierId] = useState(route.params?.supplierId || cart.supplier?.id || null);
  const [products, setProducts] = useState(null);
  const [error, setError] = useState("");
  const [showSuppliers, setShowSuppliers] = useState(!route.params?.supplierId && !cart.supplier?.id);

  const loadSuppliers = useCallback(async () => {
    try {
      setSuppliers(await getSuppliers());
      setError("");
    } catch (e) {
      setError(errorMessage(e, "Could not load suppliers."));
    }
  }, []);
  useEffect(() => { loadSuppliers(); }, [loadSuppliers]);

  useEffect(() => {
    const requestedId = route.params?.supplierId || cart.supplier?.id;
    if (requestedId) {
      setSupplierId(requestedId);
      setShowSuppliers(false);
    }
  }, [route.params?.supplierId, cart.supplier?.id]);

  useEffect(() => {
    if (!supplierId || !suppliers) return;
    const selected = suppliers.find((s) => s.id === supplierId);
    if (selected && cart.supplier?.id !== selected.id) cart.setSupplier(selected);
  }, [supplierId, suppliers]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!supplierId) { setProducts(null); return; }
    let active = true;
    setProducts(null);
    getProducts(supplierId)
      .then((items) => active && (setProducts(items || []), setError("")))
      .catch((e) => active && setError(errorMessage(e, "Could not load products.")));
    return () => { active = false; };
  }, [supplierId]);

  const pickSupplier = (id) => {
    const choose = () => { setSupplierId(id); setShowSuppliers(false); };
    if (id === supplierId) { setShowSuppliers(false); return; }
    if (cart.count > 0) {
      Alert.alert("Switch Supplier?", "Your cart has items from another supplier. Switching will clear it.", [
        { text: "Keep Cart", style: "cancel" },
        { text: "Switch", onPress: choose },
      ]);
    } else choose();
  };

  const selected = suppliers?.find((s) => s.id === supplierId);
  return (
    <Screen
      title={showSuppliers || !selected ? "Choose Your Supplier" : "Order Water"}
      subtitle={showSuppliers || !selected ? "Nearby in your area" : selected.name}
      onBack={() => showSuppliers ? navigation.navigate("Home") : setShowSuppliers(true)}
      refreshing={false}
      scroll={true}
      footer={cart.count > 0 && !showSuppliers ? (
        <Button title={`Checkout · ${money(cart.totalPaise)}`} onPress={() => navigation.navigate("Cart")} />
      ) : null}
    >
      <ErrorBanner message={error} onRetry={loadSuppliers} />
      {!suppliers && !error ? <Loading /> : null}

      {suppliers && (showSuppliers || !selected) ? (
        <>
          <Text style={styles.intro}>Trusted water, delivered by your neighbours.</Text>
          {suppliers.length === 0 ? (
            <EmptyState icon="map-pin" title="No Suppliers Nearby Yet" text="Please check again later." />
          ) : suppliers.map((s) => {
            const active = s.id === supplierId;
            return (
              <View key={s.id} style={styles.supplierCard}>
                <View style={styles.supplierTop}>
                  <View style={styles.supplierAvatar}><Text style={styles.supplierLetter}>{String(s.name || "W").slice(0, 1).toUpperCase()}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.supplierName}>{s.name}</Text>
                    <Text style={styles.supplierMeta}>{Number(s.reliabilityScore || 0).toFixed(1)}% on-time · {s.productCount ?? "Available"} products</Text>
                  </View>
                  <View style={styles.verified}><Text style={styles.verifiedText}>✓ Trusted</Text></View>
                </View>
                <Button title={active ? "Selected Supplier" : "Set as My Supplier"} small variant={active ? "dark" : "outline"} onPress={() => pickSupplier(s.id)} />
              </View>
            );
          })}
          <View style={styles.qualityNote}><Text style={styles.noteIcon}>ⓘ</Text><Text style={styles.noteText}>Supplier details and available products are loaded from your Water'O'Water service.</Text></View>
        </>
      ) : null}

      {selected && !showSuppliers ? (
        <>
          <Pressable onPress={() => setShowSuppliers(true)} style={styles.selectedSupplier}>
            <View style={styles.supplierAvatar}><Text style={styles.supplierLetter}>{String(selected.name || "W").slice(0, 1).toUpperCase()}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.smallLabel}>Ordering From</Text>
              <Text style={styles.supplierName}>{selected.name}</Text>
            </View>
            <Text style={styles.change}>Change</Text>
          </Pressable>
          <Text style={styles.sectionTitle}>Choose Your Water</Text>
          {!products ? <Loading /> : products.length === 0 ? (
            <EmptyState icon="droplet" title="No Products Yet" text="This supplier has not added any products." />
          ) : products.map((p) => (
            <ProductCard key={p.id} product={p} qty={cart.qtyOf(p.id)} onChange={(q) => cart.setQty(p, q)} />
          ))}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { fontFamily: fonts.body, fontSize: 12.5, color: colors.inkSoft, marginBottom: 14, lineHeight: 18 },
  supplierCard: { backgroundColor: "#FFFFFF", borderRadius: radius.lg, padding: 13, borderWidth: 1, borderColor: colors.canLine, marginBottom: 10, ...shadow.card },
  supplierTop: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  supplierAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.customerBg, borderWidth: 1, borderColor: colors.canLine, alignItems: "center", justifyContent: "center" },
  supplierLetter: { fontFamily: fonts.displayBold, fontSize: 18, color: colors.primaryDark },
  supplierName: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: colors.ink },
  supplierMeta: { fontFamily: fonts.body, fontSize: 10.5, color: colors.inkSoft, marginTop: 3 },
  verified: { paddingHorizontal: 8, paddingVertical: 5, backgroundColor: colors.customerBg, borderRadius: radius.pill },
  verifiedText: { fontFamily: fonts.bodySemi, fontSize: 9.5, color: colors.primaryDark },
  qualityNote: { flexDirection: "row", gap: 8, alignItems: "center", padding: 12, borderRadius: radius.md, backgroundColor: colors.customerBg, marginTop: 3 },
  noteIcon: { fontSize: 16, color: colors.primaryDark },
  noteText: { flex: 1, fontFamily: fonts.body, fontSize: 10.5, lineHeight: 15, color: colors.inkSoft },
  selectedSupplier: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: radius.lg, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: colors.canLine, marginBottom: 16 },
  smallLabel: { fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 0.8, color: colors.inkSoft, marginBottom: 3 },
  change: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.primary },
  sectionTitle: { fontFamily: fonts.displayBold, fontSize: 16, color: colors.primaryDark, marginBottom: 10 },
});
