import React, { useCallback, useEffect, useState } from "react";
import NotificationBell from "../../components/NotificationBell";
import Icon from "../../components/Icon";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { LanguageToggle, Text } from "../../i18n";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getBootstrap, getProducts } from "../../api/customer";
import { errorMessage } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import usePolling from "../../hooks/usePolling";
import { Avatar, Button, ErrorBanner, Loading, Screen } from "../../components/ui";
import { colors, fonts, radius, shadow } from "../../theme/colors";
import { firstName, isInProgress, itemsSummary, money, statusMeta } from "../../utils/format";

export default function CustomerHome({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const cart = useCart();
  const [data, setData] = useState(null);
  const [quickProducts, setQuickProducts] = useState([]);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await getBootstrap();
      setData(result);
      setError("");
      const supplier = result?.suppliers?.find((s) => s.id === cart.supplier?.id) || result?.suppliers?.[0];
      if (supplier?.id) {
        const products = await getProducts(supplier.id);
        setQuickProducts((products || []).slice(0, 4));
      } else {
        setQuickProducts([]);
      }
    } catch (e) {
      setError(errorMessage(e, "Could not load your home screen."));
    }
  }, [cart.supplier?.id]);
  usePolling(load, 15000);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (!data && !error) return <Screen hideHeader scroll={false} contentStyle={{ paddingTop: insets.top + 18 }}><Loading /></Screen>;

  const orders = data?.orders || [];
  const live = [...orders]
    .filter((o) => isInProgress(o.status) || o.status === "placed")
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
  const suppliers = data?.suppliers || [];
  const supplier = suppliers.find((s) => s.id === cart.supplier?.id) || suppliers[0];
  const location = data?.address?.line || data?.customer?.address || "Choose Your Delivery Address";


  const addProduct = (product) => {
    if (!supplier) {
      navigation.navigate("Order");
      return;
    }
    if (cart.supplier?.id !== supplier.id) cart.setSupplier(supplier);
    cart.setQty(product, cart.qtyOf(product.id) + 1);
  };

  return (
    <Screen
      hideHeader
      refreshing={refreshing}
      onRefresh={refresh}
      contentStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 18 }}
    >
      <View style={styles.topLine}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>Vanakkam, {firstName(data?.customer?.name || user?.name)}!</Text>
          <Text style={styles.welcome}>Let’s keep your home hydrated.</Text>
        </View>
        <LanguageToggle tone="light" style={{ marginRight: 2 }} />
        <NotificationBell />
      </View>

      <Pressable onPress={() => navigation.navigate("Profile")} style={styles.locationPill}>
        <Text style={styles.pin}>⌖</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.locationText} numberOfLines={1}>{location}</Text>
          <Text style={styles.locationCaption}>Delivery Location</Text>
        </View>
        <Text style={styles.chevron}>⌄</Text>
      </Pressable>

      <View style={styles.refillCard}>
        <View style={styles.refillTop}>
          <View style={styles.ring}>
            <Text style={styles.ringSymbol}>{live ? "↗" : "＋"}</Text>
            <Text style={styles.ringCaption}>{live ? "Live" : "Refill"}</Text>
          </View>
          <View style={styles.refillCopy}>
            <Text style={styles.refillTitle}>{live ? "Your refill is on its way" : "Fresh water, on your schedule"}</Text>
            <Text style={styles.refillText}>
              {live
                ? `${itemsSummary(live)} · ${statusMeta(live.status).label}`
                : "Choose your trusted supplier and order your next water refill."}
            </Text>
          </View>
        </View>
        <Button
          title={live ? "Track Your Order" : "Order Water"}
          onPress={() => live ? navigation.navigate("TrackOrder", { orderId: live.id }) : navigation.navigate("Order")}
          style={styles.mainButton}
        />
      </View>

      {live ? (
        <Pressable onPress={() => navigation.navigate("TrackOrder", { orderId: live.id })} style={styles.liveStrip}>
          <View style={styles.truckIcon}><Text style={styles.truckText}>↗</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.liveTitle}>Your refill is on its way</Text>
            <Text style={styles.liveMeta}>{live.eta ? `Arrives by ${live.eta}` : "Tap to see the latest delivery status"}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      ) : null}

      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>Quick Order</Text>
        <Pressable onPress={() => navigation.navigate("Order")}><Text style={styles.viewAll}>View all ›</Text></Pressable>
      </View>
      {quickProducts.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.productsRow}>
          {quickProducts.slice(0, 4).map((p) => (
            <View key={p.id} style={styles.productTile}>
              <View style={styles.productImage}><Icon name="droplet" size={34} /></View>
              <Pressable style={styles.addButton} onPress={() => addProduct(p)}><Text style={styles.addText}>＋</Text></Pressable>
              <Text style={styles.productName} numberOfLines={2}>{p.nameEn || p.name}</Text>
              <Text style={styles.productPrice}>{money(p.unitPricePaise)} <Text style={styles.perCan}>/ refill</Text></Text>
            </View>
          ))}
        </ScrollView>
      ) : (
        <Pressable onPress={() => navigation.navigate("Order")} style={styles.emptyQuick}>
          <Text style={styles.emptyIcon}>＋</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.emptyTitle}>Browse Water Products</Text>
            <Text style={styles.emptySub}>Choose a supplier to see available cans and packs.</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      )}

      <Pressable onPress={() => navigation.navigate("Order")} style={styles.planBanner}>
        <View style={styles.planCopy}>
          <Text style={styles.planTitle}>Refills on Repeat</Text>
          <Text style={styles.planSub}>Explore monthly refill options and order when you need them.</Text>
        </View>
        <Text style={styles.planArrow}>→</Text>
      </Pressable>

      <ErrorBanner message={error} onRetry={load} />
      <View style={styles.bottomNote}>
        <Text style={styles.bottomNoteText}>Trusted water · Reliable delivery · Live updates</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topLine: { flexDirection: "row", alignItems: "center", marginBottom: 16, gap: 12 },
  greeting: { fontFamily: fonts.displayBold, fontSize: 22, lineHeight: 28, color: colors.primaryDark },
  welcome: { fontFamily: fonts.body, fontSize: 12, color: colors.inkSoft, marginTop: 2 },
  bell: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: colors.canLine, alignItems: "center", justifyContent: "center" },
  bellIcon: { fontSize: 21, color: colors.primaryDark },
  bellDot: { position: "absolute", width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent, top: 8, right: 8 },
  locationPill: { flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 13, paddingVertical: 10, borderRadius: radius.pill, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: colors.canLine, marginBottom: 14 },
  pin: { color: colors.primary, fontSize: 20 },
  locationText: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.ink },
  locationCaption: { fontFamily: fonts.body, fontSize: 10, color: colors.inkSoft, marginTop: 1 },
  chevron: { fontSize: 22, color: colors.inkSoft },
  refillCard: { padding: 15, borderRadius: radius.xl, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: colors.canLine, ...shadow.card },
  refillTop: { flexDirection: "row", alignItems: "center", gap: 13, marginBottom: 14 },
  ring: { width: 70, height: 70, borderRadius: 35, borderWidth: 5, borderColor: colors.accent, backgroundColor: colors.customerBg, alignItems: "center", justifyContent: "center" },
  ringSymbol: { fontFamily: fonts.displayBold, fontSize: 22, lineHeight: 25, color: colors.primaryDark },
  ringCaption: { fontFamily: fonts.bodyBold, fontSize: 8, letterSpacing: 1, color: colors.primary },
  refillCopy: { flex: 1 },
  refillTitle: { fontFamily: fonts.displayBold, fontSize: 15, color: colors.primaryDark, lineHeight: 21 },
  refillText: { fontFamily: fonts.body, fontSize: 11, color: colors.inkSoft, lineHeight: 16, marginTop: 4 },
  mainButton: { minHeight: 44, borderRadius: radius.pill },
  liveStrip: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12, padding: 12, borderRadius: radius.lg, backgroundColor: colors.customerBg, borderWidth: 1, borderColor: colors.canLine },
  truckIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  truckText: { color: colors.primaryDark, fontSize: 19 },
  liveTitle: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.primaryDark },
  liveMeta: { fontFamily: fonts.body, fontSize: 10.5, color: colors.inkSoft, marginTop: 3 },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 19, marginBottom: 9 },
  sectionTitle: { fontFamily: fonts.displayBold, fontSize: 16, color: colors.primaryDark },
  viewAll: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.primary },
  productsRow: { gap: 10, paddingBottom: 2 },
  productTile: { width: 145, minHeight: 158, backgroundColor: "#FFFFFF", borderRadius: radius.lg, borderWidth: 1, borderColor: colors.canLine, padding: 11, position: "relative", ...shadow.card },
  productImage: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.customerBg, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  canEmoji: { fontSize: 28 },
  addButton: { position: "absolute", top: 14, right: 12, width: 29, height: 29, borderRadius: 15, backgroundColor: colors.customerBg, borderWidth: 1, borderColor: colors.canLine, alignItems: "center", justifyContent: "center" },
  addText: { fontSize: 19, lineHeight: 22, color: colors.primaryDark },
  productName: { fontFamily: fonts.bodySemi, fontSize: 11.5, lineHeight: 15, color: colors.ink, minHeight: 30 },
  productPrice: { fontFamily: fonts.bodyBold, fontSize: 11.5, color: colors.primaryDark, marginTop: 5 },
  perCan: { fontFamily: fonts.body, fontSize: 9.5, color: colors.inkSoft },
  emptyQuick: { flexDirection: "row", alignItems: "center", gap: 10, padding: 13, backgroundColor: "#FFFFFF", borderRadius: radius.lg, borderWidth: 1, borderColor: colors.canLine },
  emptyIcon: { width: 35, height: 35, textAlign: "center", textAlignVertical: "center", backgroundColor: colors.customerBg, color: colors.primaryDark, borderRadius: 18, fontSize: 24, overflow: "hidden" },
  emptyTitle: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: colors.ink },
  emptySub: { fontFamily: fonts.body, fontSize: 10.5, color: colors.inkSoft, marginTop: 2 },
  planBanner: { flexDirection: "row", alignItems: "center", marginTop: 13, borderRadius: radius.lg, padding: 15, backgroundColor: colors.primaryDark, ...shadow.lift },
  planCopy: { flex: 1 },
  planTitle: { fontFamily: fonts.displayBold, fontSize: 14, color: "#FFFFFF" },
  planSub: { fontFamily: fonts.body, fontSize: 10.5, lineHeight: 15, color: colors.onDarkSoft, marginTop: 4, maxWidth: 250 },
  planArrow: { fontFamily: fonts.displayBold, fontSize: 23, color: "#FFFFFF", marginLeft: 8 },
  bottomNote: { alignItems: "center", paddingVertical: 15 },
  bottomNoteText: { fontFamily: fonts.body, fontSize: 9.5, color: colors.inkFaint },
});
