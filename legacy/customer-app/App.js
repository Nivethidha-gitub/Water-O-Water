
import React, { useEffect, useState } from "react";

import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";

import HomeScreen from "./src/screens/HomeScreen";
import OrderScreen from "./src/screens/OrderScreen";
import OrdersScreen from "./src/screens/OrdersScreen";
import TrackScreen from "./src/screens/TrackScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import OrderConfirmedScreen from "./src/screens/OrderConfirmedScreen";

import BottomTabBar from "./src/components/BottomTabBar";

import {
  getBootstrap,
  getProducts,
} from "./src/api";

import { COLORS } from "./src/styles/theme";

export default function App() {
  const [screen, setScreen] = useState("home");

  const [quantities, setQuantities] = useState({
    can20: 2,
    pack1: 0,
    pack500: 0,
  });

  const [data, setData] = useState(null);
  const [products, setProducts] = useState([]);

  const [confirmedOrder, setConfirmedOrder] =
    useState(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAppData();
  }, []);

  async function loadAppData() {
  try {
    const result = await getBootstrap(
      "cust-ayesha"
    );

    const productList = await getProducts();

    setData(result);

    setProducts(
      Array.isArray(productList)
        ? productList.map((product) => ({
            id: product.id,
            name: product.nameEn,
            description:
              product.nameTa || "",
            price:
              Number(
                product.unitPricePaise || 0
              ) / 100,
          }))
        : []
    );
    } catch (error) {
      console.log(
        "Backend error:",
        error
      );

      Alert.alert(
        "Connection Error",
        "Could not connect to the WoW backend."
      );
    } finally {
      setLoading(false);
    }
  }

  function changeQuantity(
    productId,
    amount
  ) {
    setQuantities((current) => ({
      ...current,
      [productId]: Math.max(
        0,
        (current[productId] || 0) + amount
      ),
    }));
  }

  function handleOrderConfirmed(order) {
    console.log(
      "APP: Setting confirmed order:",
      order
    );

    setConfirmedOrder(order);

    console.log(
      "APP: Navigating to confirmed screen"
    );

    setScreen("confirmed");
  }

  function renderScreen() {
    console.log(
      "CURRENT SCREEN:",
      screen
    );

    console.log(
      "CONFIRMED ORDER:",
      confirmedOrder
    );

    if (screen === "home") {
      return (
        <HomeScreen
          quantities={quantities}
          changeQuantity={changeQuantity}
          setScreen={setScreen}
          data={data}
            products={products}
        />
      );
    }

    if (screen === "order") {
      return (
        <OrderScreen
          quantities={quantities}
          changeQuantity={changeQuantity}
          setScreen={setScreen}
          data={data}
          setConfirmedOrder={
            handleOrderConfirmed
          }
          products={products}
        />
      );
    }

    if (screen === "confirmed") {
      return (
        <OrderConfirmedScreen
          order={confirmedOrder}
          setScreen={setScreen}
        />
      );
    }

    if (screen === "orders") {
      return (
        <OrdersScreen
          setScreen={setScreen}
          data={data}
        />
      );
    }

    if (screen === "track") {
      return (
        <TrackScreen
          setScreen={setScreen}
          data={data}
          confirmedOrder={confirmedOrder}
        />
      );
    }

    if (screen === "profile") {
      return (
        <ProfileScreen
          data={data}
           setScreen={setScreen}
        />
      );
    }

    return null;
  }

  if (loading) {
    return (
      <SafeAreaView
        style={styles.loadingContainer}
      >
        <ActivityIndicator
          size="large"
          color={COLORS.secondary}
        />

        <Text style={styles.loadingText}>
          Loading WoW...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.appHeader}>
        <Text style={styles.title}>
          WoW
        </Text>

        <Text style={styles.subtitle}>
          Water O Water
        </Text>
      </View>

      <View style={styles.screen}>
        {renderScreen()}
      </View>

      {screen !== "confirmed" && (
        <BottomTabBar
          screen={screen}
          setScreen={setScreen}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor:
      COLORS.background,
  },

  loadingContainer: {
    flex: 1,
    backgroundColor:
      COLORS.background,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    color: COLORS.primary,
    marginTop: 12,
    fontWeight: "600",
  },

  appHeader: {
    backgroundColor:
      COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },

  title: {
    color: COLORS.white,
    fontSize: 22,
    fontWeight: "700",
  },

  subtitle: {
    color: "#CDE6ED",
    fontSize: 12,
    marginTop: 2,
  },

  screen: {
    flex: 1,
  },
});

