import React, { useEffect, useRef } from "react";
import { Animated, Image, Pressable, StyleSheet, View } from "react-native";
import { Text } from "../i18n";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../context/AuthContext";
import { useRealtime } from "../realtime/RealtimeContext";
import { openNotification } from "../navigation/navRef";
import { fonts, shadow } from "../theme/colors";

export default function LiveBanner() {
  const { banner, dismissBanner } = useRealtime();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-180)).current;
  const lastBanner = useRef(null);

  useEffect(() => {
    if (banner) {
      lastBanner.current = banner;
    }

    Animated.spring(translateY, {
      toValue: banner ? 0 : -180,
      useNativeDriver: true,
      friction: 9,
      tension: 70,
    }).start();
  }, [banner, translateY]);

  const shown = banner || lastBanner.current;

  if (!shown) {
    return null;
  }

  const handlePress = () => {
    dismissBanner();

    if (user) {
      openNotification(user.role, shown.data || {});
    }
  };

  return (
    <Animated.View
      pointerEvents={banner ? "auto" : "none"}
      style={[
        styles.container,
        {
          top: insets.top + 8,
          transform: [{ translateY }],
        },
      ]}
    >
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={`${shown.title}. ${shown.body || ""}`}
        style={styles.card}
      >
        <Image
          source={require("../../assets/icon.png")}
          style={styles.logo}
          resizeMode="contain"
        />

        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>
              {shown.title || "Water'O'Water"}
            </Text>

            <Text style={styles.time}>now</Text>
          </View>

          {!!shown.body && (
            <Text style={styles.message} numberOfLines={2}>
              {shown.body}
            </Text>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 1000,
    elevation: 20,
  },

  card: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingVertical: 14,
    gap: 12,
    backgroundColor: "#244F60",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#386879",
    ...shadow.lift,
  },

  logo: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#17677A",
  },

  content: {
    flex: 1,
    minWidth: 0,
  },

  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },

  title: {
    flex: 1,
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: "#FFFFFF",
  },

  time: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: "#D8E8ED",
  },

  message: {
    marginTop: 4,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: "#F0F7F9",
  },
});
