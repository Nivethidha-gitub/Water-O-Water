import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { Text, t, useLanguage } from "../i18n";
import Icon from "../components/Icon";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { navRef } from "./navRef";
import { onNotificationTap } from "../notifications/localNotify";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import { useAuth } from "../context/AuthContext";
import { Button, Loading } from "../components/ui";
import { useSignOut } from "../components/Header";
import { colors, fonts } from "../theme/colors";

import AuthScreen from "../screens/common/AuthScreen";
import WelcomeScreen from "../screens/common/WelcomeScreen";

import CustomerHome from "../screens/customer/CustomerHome";
import CustomerHistory from "../screens/customer/CustomerHistory";
import Receipt from "../screens/customer/Receipt";
import AddressesScreen from "../screens/customer/AddressesScreen";
import NotificationsScreen from "../screens/common/NotificationsScreen";
import HelpScreen from "../screens/common/HelpScreen";
import ProductsScreen from "../screens/customer/ProductsScreen";
import CartScreen from "../screens/customer/CartScreen";
import OrderSuccess from "../screens/customer/OrderSuccess";
import MyOrders from "../screens/customer/MyOrders";
import TrackOrder from "../screens/customer/TrackOrder";
import CustomerProfile from "../screens/customer/CustomerProfile";

import SupplierHome from "../screens/supplier/SupplierHome";
import LiveOrders from "../screens/supplier/LiveOrders";
import OrderDetail from "../screens/supplier/OrderDetail";
import Riders from "../screens/supplier/Riders";
import SupplierProducts from "../screens/supplier/SupplierProducts";
import ServiceAreas from "../screens/supplier/ServiceAreas";
import SupplierMore from "../screens/supplier/SupplierMore";

import RiderHome from "../screens/rider/RiderHome";
import RiderVerification from "../screens/rider/RiderVerification";
import DeliveryDetail from "../screens/rider/DeliveryDetail";
import RiderHistory from "../screens/rider/RiderHistory";
import RiderProfile from "../screens/rider/RiderProfile";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const navTheme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.bg, primary: colors.primary } };
const stackOptions = { headerShown: false };

// Tab icons are line icons in the theme colour (active = brand blue, inactive = grey).
const icon = (name) => ({ color }) => <Icon name={name} size={22} color={color} />;

const tabOptions = {
  headerShown: false,
  tabBarActiveTintColor: colors.primary,
  tabBarInactiveTintColor: "#8FA2AC",
  tabBarLabelStyle: { fontFamily: fonts.bodySemi, fontSize: 10.5, marginBottom: 4 },
  tabBarStyle: { backgroundColor: "#FFFFFF", borderTopColor: "#DDEAF0", height: 68, paddingTop: 5, paddingBottom: 5, elevation: 12 },
};

const roleTabOptions = (active) => ({ route }) => ({ ...tabOptions, tabBarActiveTintColor: active, tabBarLabel: t(route.name) });

// ---- Customer: Home, Orders, Cart, Profile ----------------------------------

function CustomerTabs() {
  useLanguage(); // re-render the tab labels when the language changes
  return (
    <Tab.Navigator screenOptions={roleTabOptions(colors.customer)}>
      <Tab.Screen name="Home" component={CustomerHome} options={{ tabBarIcon: icon("home") }} />
      <Tab.Screen name="Order" component={ProductsScreen} options={{ tabBarIcon: icon("shopping-bag") }} />
      <Tab.Screen name="Track" component={MyOrders} options={{ tabBarIcon: icon("map-pin") }} />
      <Tab.Screen name="Profile" component={CustomerProfile} options={{ tabBarIcon: icon("user") }} />
    </Tab.Navigator>
  );
}

function CustomerNavigator() {
  return (
    <Stack.Navigator screenOptions={stackOptions}>
      <Stack.Screen name="Tabs" component={CustomerTabs} />
      <Stack.Screen name="Products" component={ProductsScreen} />
      <Stack.Screen name="Cart" component={CartScreen} />
      <Stack.Screen name="OrderSuccess" component={OrderSuccess} options={{ gestureEnabled: false }} />
      <Stack.Screen name="TrackOrder" component={TrackOrder} />
      <Stack.Screen name="History" component={CustomerHistory} />
      <Stack.Screen name="Receipt" component={Receipt} />
      <Stack.Screen name="Addresses" component={AddressesScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Help" component={HelpScreen} />
    </Stack.Navigator>
  );
}

// ---- Supplier: Home, Orders, Riders, Products, More --------------------------

function SupplierTabs() {
  useLanguage(); // re-render the tab labels when the language changes
  return (
    <Tab.Navigator screenOptions={roleTabOptions(colors.supplierDark)}>
      <Tab.Screen name="Home" component={SupplierHome} options={{ tabBarIcon: icon("home") }} />
      <Tab.Screen name="Orders" component={LiveOrders} options={{ tabBarIcon: icon("package") }} />
      <Tab.Screen name="Riders" component={Riders} options={{ tabBarIcon: icon("users") }} />
      <Tab.Screen name="Products" component={SupplierProducts} options={{ tabBarIcon: icon("droplet") }} />
      <Tab.Screen name="More" component={SupplierMore} options={{ tabBarIcon: icon("settings") }} />
    </Tab.Navigator>
  );
}

function SupplierNavigator() {
  return (
    <Stack.Navigator screenOptions={stackOptions}>
      <Stack.Screen name="Tabs" component={SupplierTabs} />
      <Stack.Screen name="SupplierOrder" component={OrderDetail} />
      <Stack.Screen name="ServiceAreas" component={ServiceAreas} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
    </Stack.Navigator>
  );
}

// ---- Rider: Deliveries, History, Profile -------------------------------------

function RiderTabs() {
  useLanguage(); // re-render the tab labels when the language changes
  return (
    <Tab.Navigator screenOptions={roleTabOptions(colors.riderDark)}>
      <Tab.Screen name="Deliveries" component={RiderHome} options={{ tabBarIcon: icon("truck") }} />
      <Tab.Screen name="History" component={RiderHistory} options={{ tabBarIcon: icon("clipboard") }} />
      <Tab.Screen name="Profile" component={RiderProfile} options={{ tabBarIcon: icon("user") }} />
    </Tab.Navigator>
  );
}

function RiderNavigator() {
  const { user } = useAuth();
  // A new rider can only see their verification status until the supplier approves their ID.
  if (user.approvalStatus && user.approvalStatus !== "approved") {
    return (
      <Stack.Navigator screenOptions={stackOptions}>
        <Stack.Screen name="Verification" component={RiderVerification} />
      </Stack.Navigator>
    );
  }
  return (
    <Stack.Navigator screenOptions={stackOptions}>
      <Stack.Screen name="Tabs" component={RiderTabs} />
      <Stack.Screen name="DeliveryDetail" component={DeliveryDetail} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
    </Stack.Navigator>
  );
}

// ---- Signed out ----------------------------------------------------------------

function AuthNavigator() {
  // The first page is the brand Welcome screen; it leads to Sign In / Sign Up.
  return (
    <Stack.Navigator screenOptions={stackOptions} initialRouteName="Welcome">
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Auth" component={AuthScreen} />
    </Stack.Navigator>
  );
}

function UnknownRole() {
  const signOut = useSignOut();
  const { user } = useAuth();
  return (
    <View style={styles.unknown}>
      <StatusBar style="dark" />
      <Text style={styles.unknownTitle}>This account can't use the app</Text>
      <Text style={styles.unknownText}>
        The account role "{String(user?.role)}" is not supported on mobile.
      </Text>
      <Button title="Sign Out" variant="danger" onPress={signOut} />
    </View>
  );
}

/*
 * The account's role (as reported by the server after sign-in / sign-up)
 * decides which app opens. Signing out drops back to the Welcome screen.
 */
export default function AppNavigator() {
  const { user, loading } = useAuth();

  // Tapping a system notification opens the order it is about (or the notifications list).
  const role = user ? user.role : null;
  useEffect(() => {
    if (!role) return undefined;
    return onNotificationTap((data) => {
      const go = () => {
        if (!navRef.isReady()) return setTimeout(go, 300);
        if (data.orderId) {
          const target = role === "CUSTOMER" ? "TrackOrder" : role === "SUPPLIER" ? "SupplierOrder" : "DeliveryDetail";
          navRef.navigate(target, { orderId: data.orderId });
        } else navRef.navigate("Notifications");
      };
      go();
    });
  }, [role]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <StatusBar style="dark" />
        <Loading />
      </View>
    );
  }

  let content;
  if (!user) content = <AuthNavigator />;
  else if (user.role === "CUSTOMER") content = <CustomerNavigator />;
  else if (user.role === "SUPPLIER") content = <SupplierNavigator />;
  else if (user.role === "RIDER") content = <RiderNavigator />;
  else content = <UnknownRole />;

  // `key` resets navigation state when a different account signs in.
  return (
    <NavigationContainer ref={navRef} theme={navTheme} key={user ? `${user.id}:${user.role}` : "guest"}>
      {content}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  unknown: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: colors.bg, gap: 12 },
  unknownTitle: { fontFamily: fonts.display, fontSize: 20, color: colors.primaryDark },
  unknownText: { fontFamily: fonts.body, fontSize: 14, color: colors.inkSoft, marginBottom: 8 },
});