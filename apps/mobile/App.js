import React, { useCallback, useEffect } from "react";
import { View } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { SafeAreaProvider } from "react-native-safe-area-context";
// One import per weight, so only the fonts the app uses are bundled.
import { Poppins_600SemiBold } from "@expo-google-fonts/poppins/600SemiBold";
import { Poppins_700Bold } from "@expo-google-fonts/poppins/700Bold";
import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_500Medium } from "@expo-google-fonts/inter/500Medium";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { Inter_700Bold } from "@expo-google-fonts/inter/700Bold";

import { AuthProvider } from "./src/context/AuthContext";
import { LanguageProvider } from "./src/i18n";
import "./src/tasks/backgroundLocation"; // registers the background location task
import { CartProvider } from "./src/context/CartContext";
import AppNavigator from "./src/navigation/AppNavigator";
import { RealtimeProvider } from "./src/realtime/RealtimeContext";
import LiveBanner from "./src/components/LiveBanner";
import { DialogHost } from "./src/components/ThemedDialog";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Poppins_600SemiBold,
    Poppins_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const ready = fontsLoaded || !!fontError; // a font failure falls back to system fonts

  const onLayout = useCallback(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1 }} onLayout={onLayout}>
        <LanguageProvider>
          <AuthProvider>
            <RealtimeProvider>
              <CartProvider>
                <StatusBar style="light" />
                <AppNavigator />
                <LiveBanner />
                <DialogHost />
              </CartProvider>
            </RealtimeProvider>
          </AuthProvider>
        </LanguageProvider>
      </View>
    </SafeAreaProvider>
  );
}
