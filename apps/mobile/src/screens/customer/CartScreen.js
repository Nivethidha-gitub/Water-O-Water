import React, { useEffect, useState } from "react";
import { Linking, Platform, StyleSheet, View } from "react-native";
import { Text } from "../../i18n";
import { Alert } from "../../utils/alert";

import { createUpiPaymentLink, getAddresses, getOrderDetails, getPaymentStatus, placeOrder } from "../../api/customer";
import { errorMessage } from "../../api/client";
import { useCart } from "../../context/CartContext";
import { Button, Card, Chip, EmptyState, Field, RadioGroup, Row, Screen, SectionTitle, Segmented, Stepper } from "../../components/ui";
import { colors, fonts } from "../../theme/colors";
import { money } from "../../utils/format";

const DAYS = [[1, "Mon"], [2, "Tue"], [3, "Wed"], [4, "Thu"], [5, "Fri"], [6, "Sat"], [7, "Sun"]];

const PAYMENT_OPTIONS = [
  { key: "COD", title: "Cash on Delivery", detail: "Pay when your water arrives", icon: "dollar-sign" },
  { key: "UPI", title: "UPI Payment", detail: "Google Pay, PhonePe or any UPI app", icon: "smartphone" },
];

/* "6. Cart & Place Order" */
export default function CartScreen({ navigation }) {
  const cart = useCart();
  const [type, setType] = useState("one-time");
  const [days, setDays] = useState([]);
  const [busy, setBusy] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("COD");
  const [pendingPaymentId, setPendingPaymentId] = useState(null);
  const [paymentNote, setPaymentNote] = useState("");

  const lines = Object.values(cart.lines);

  // Saved addresses: deliver to the chosen one, with optional instructions for the rider.
  const [addresses, setAddresses] = useState([]);
  const [addressId, setAddressId] = useState(null);
  const [instructions, setInstructions] = useState("");
  const chooseAddress = (id, list = addresses) => {
    setAddressId(id);
    const a = list.find((x) => x.id === id);
    setInstructions(a ? a.instructions || "" : "");
  };
  useEffect(() => {
    const loadAddresses = async () => {
      try {
        const list = await getAddresses();
        setAddresses(list);
        setAddressId((current) => {
          const keep = list.find((a) => a.id === current);
          const next = keep || list.find((a) => a.isDefault) || list[0];
          if (!keep && next) setInstructions(next.instructions || "");
          return next ? next.id : null;
        });
      } catch (_) { /* the order still goes to the default address on the server */ }
    };
    loadAddresses();
    return navigation.addListener("focus", loadAddresses); // pick up addresses added from the Addresses screen
  }, [navigation]);
  const chosenAddress = addresses.find((a) => a.id === addressId);
  const deliveryFields = { addressId: addressId || undefined, deliveryInstructions: instructions.trim() };

  useEffect(() => {
    if (!pendingPaymentId) return undefined;
    let active = true;
    let attempts = 0;
    const check = async () => {
      if (!active) return;
      attempts += 1;
      try {
        const payment = await getPaymentStatus(pendingPaymentId);
        if (!active) return;
        if (payment.status === "paid" && payment.orderId) {
          const order = await getOrderDetails(payment.orderId);
          if (!active) return;
          cart.clear();
          setPendingPaymentId(null);
          setPaymentNote("");
          navigation.navigate("OrderSuccess", { order });
          return;
        }
        if (payment.status === "failed" || payment.status === "cancelled") {
          setPaymentNote("Payment was not completed. You can try UPI again or choose cash on delivery.");
          setPendingPaymentId(null);
          return;
        }
        if (attempts >= 180) setPaymentNote("Still waiting for Razorpay confirmation. Keep this screen open or check your order history shortly.");
      } catch (_) {
        if (attempts >= 180 && active) setPaymentNote("Payment confirmation is taking longer than expected. Check your order history in a moment.");
      }
    };
    const timer = setInterval(check, 4000);
    check();
    return () => { active = false; clearInterval(timer); };
  }, [pendingPaymentId, navigation, cart]);

  const toggleDay = (d) => setDays((c) => (c.includes(d) ? c.filter((x) => x !== d) : [...c, d]));

  const openGooglePay = async () => {
    // Opens Google Pay on Android; if it is not installed, open its Play Store listing.
    const appUrl = "tez://";
    const playUrl = "https://play.google.com/store/apps/details?id=com.google.android.apps.nbu.paisa.user";
    try {
      if (Platform.OS === "android" && await Linking.canOpenURL(appUrl)) {
        await Linking.openURL(appUrl);
      } else {
        await Linking.openURL(playUrl);
      }
    } catch (_) {
      await Linking.openURL(playUrl);
    }
  };

  const checkout = async () => {
    if (!cart.supplier || !lines.length) return;
    if (type === "recurring" && !days.length) {
      return Alert.alert("Choose Delivery Days", "Pick at least one day for your recurring order.");
    }
    if (paymentMethod === "UPI") {
      setBusy(true);
      try {
        const payment = await createUpiPaymentLink({
          supplierId: cart.supplier.id,
          items: lines.map((l) => ({ productId: l.product.id, qty: l.qty })),
          orderType: type,
          frequency: type === "recurring" ? (days.length === 7 ? "daily" : days.length === 1 ? "weekly" : "custom") : undefined,
          deliveryDays: type === "recurring" ? days : undefined,
          ...deliveryFields,
        });
        if (!payment.shortUrl) throw new Error("The payment provider did not return a checkout link.");
        await Linking.openURL(payment.shortUrl);
        setPaymentNote("Secure Razorpay checkout opened. Return to this app after paying; your order will confirm automatically when Razorpay verifies the payment.");
        setPendingPaymentId(payment.intentId);
      } catch (e) {
        Alert.alert("Payment Unavailable", errorMessage(e, "Unable to start UPI checkout."));
      } finally { setBusy(false); }
      return;
    }
    setBusy(true);
    try {
      const order = await placeOrder({
        supplierId: cart.supplier.id,
        items: lines.map((l) => ({ productId: l.product.id, qty: l.qty })),
        orderType: type,
        frequency: type === "recurring" ? (days.length === 7 ? "daily" : days.length === 1 ? "weekly" : "custom") : undefined,
        deliveryDays: type === "recurring" ? days : undefined,
        paymentMethod,
        ...deliveryFields,
      });
      cart.clear();
      setType("one-time");
      setDays([]);
      navigation.navigate("OrderSuccess", { order });
    } catch (e) {
      Alert.alert("Order Failed", errorMessage(e, "Unable to place your order."));
    } finally {
      setBusy(false);
    }
  };

  if (!lines.length) {
    return (
      <Screen brand subtitle="Customer" scroll={false}>
        <EmptyState
          icon="shopping-cart"
          title="Your Cart is Empty"
          text="Add water cans from a supplier to place an order."
          action={<Button title="Browse Products" onPress={() => navigation.navigate("Products")} />}
        />
      </Screen>
    );
  }

  return (
    <Screen
      brand
      subtitle="Customer"
      footer={<Button title={paymentMethod === "UPI" ? `Pay ${money(cart.totalPaise)} & Place Order` : `Place Order · ${money(cart.totalPaise)}`} onPress={checkout} busy={busy} />}
    >
      <Text style={styles.title}>Checkout</Text>
      <View style={styles.from}>
        <Text style={styles.fromLabel}>Ordering From</Text>
        <Text style={styles.fromName}>{cart.supplier?.name}</Text>
      </View>

      {lines.map((l) => (
        <Card key={l.product.id} style={styles.line}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{l.product.nameEn || l.product.name}</Text>
            <Text style={styles.price}>{money(l.product.unitPricePaise)} each</Text>
          </View>
          <View style={{ alignItems: "flex-end", gap: 8 }}>
            <Stepper value={l.qty} onChange={(q) => cart.setQty(l.product, q)} />
            <Text style={styles.lineTotal}>{money(l.product.unitPricePaise * l.qty)}</Text>
          </View>
        </Card>
      ))}

      <SectionTitle>Deliver To</SectionTitle>
      {addresses.length ? (
        <RadioGroup
          options={addresses.map((a) => ({ key: a.id, title: a.isDefault ? `${a.label} · Default` : a.label, detail: a.line, icon: a.label === "Work" ? "briefcase" : a.label === "Other" ? "map-pin" : "home" }))}
          value={addressId}
          onChange={(id) => chooseAddress(id)}
          style={{ marginBottom: 10 }}
        />
      ) : null}
      <Button title={addresses.length ? "Add or Edit Addresses" : "Add a Delivery Address"} icon="map-pin" variant="outline" small onPress={() => navigation.navigate("Addresses")} style={{ marginBottom: 12 }} />
      <Field label="Delivery Instructions" placeholder="e.g. Call at the gate, 2nd floor" value={instructions} onChangeText={setInstructions} maxLength={200} />

      <SectionTitle>Delivery Type</SectionTitle>
      <Segmented
        options={[{ key: "one-time", label: "One-time" }, { key: "recurring", label: "Recurring" }]}
        value={type}
        onChange={setType}
      />
      <SectionTitle>How Would You Like to Pay?</SectionTitle>
      <RadioGroup options={PAYMENT_OPTIONS} value={paymentMethod} onChange={setPaymentMethod} style={{ marginBottom: 8 }} />
      {paymentMethod === "UPI" ? <View><Text style={styles.hint}>Pay securely through Razorpay. Your order is confirmed only after the server verifies the payment webhook.</Text>{paymentNote ? <Text style={styles.paymentNote}>{paymentNote}</Text> : null}</View> : null}

      {type === "recurring" ? (
        <View style={{ marginTop: 14 }}>
          <Text style={styles.hint}>Deliver on these days every week:</Text>
          <View style={styles.days}>
            {DAYS.map(([d, label]) => (
              <Chip key={d} label={label} active={days.includes(d)} onPress={() => toggleDay(d)} />
            ))}
          </View>
        </View>
      ) : null}

      <SectionTitle>Order Summary</SectionTitle>
      <Card>
        <Row label="Supplier" value={cart.supplier?.name} />
        <View style={styles.rule} />
        {lines.map((l) => (
          <Row
            key={l.product.id}
            label={`${l.qty} × ${l.product.nameEn || l.product.name}`}
            value={money((Number(l.product.unitPricePaise) || 0) * l.qty)}
          />
        ))}
        <View style={styles.rule} />
        {chosenAddress ? <Row label="Deliver To" value={chosenAddress.line} /> : null}
        <Row label="Subtotal" value={money(cart.totalPaise)} />
        <Row label="Delivery Fee" value="Free" />
        <Row
          label="Delivery"
          value={type === "recurring" ? (days.length ? `Every ${DAYS.filter(([d]) => days.includes(d)).map(([, n]) => n).join(", ")}` : "Recurring · Choose Days") : "One-Time Delivery"}
        />
        <Row label="Payment" value={paymentMethod === "COD" ? "Cash on Delivery" : "UPI Payment"} />
        <View style={styles.rule} />
        <Row label="Total" value={money(cart.totalPaise)} bold />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.display, fontSize: 24, color: colors.primaryDark, marginBottom: 12 },
  from: { backgroundColor: colors.can, borderRadius: 14, padding: 12, marginBottom: 14 },
  fromLabel: { fontFamily: fonts.bodyBold, fontSize: 10.5, letterSpacing: 0.5, color: colors.primary },
  fromName: { fontFamily: fonts.display, fontSize: 16, color: colors.primaryDark, marginTop: 2 },
  line: { flexDirection: "row", alignItems: "center", gap: 12 },
  name: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  price: { fontFamily: fonts.body, fontSize: 12.5, color: colors.inkSoft, marginTop: 2 },
  lineTotal: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.primaryDark },
  hint: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft, marginBottom: 10 },
  days: { flexDirection: "row", flexWrap: "wrap", rowGap: 8 },
  rule: { height: 1, backgroundColor: "#E3EEF2", marginVertical: 6 },
  paymentNote: { fontFamily: fonts.body, fontSize: 12, lineHeight: 18, color: colors.primaryDark, marginTop: 10, padding: 10, borderRadius: 10, backgroundColor: colors.can },
});
