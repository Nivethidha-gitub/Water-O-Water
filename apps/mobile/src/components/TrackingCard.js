import React, { useEffect, useMemo, useRef, useState } from "react";
import Icon from "./Icon";
import { StyleSheet, View } from "react-native";
import { Text } from "../i18n";
import * as Location from "expo-location";
import MapView, { Marker, Polyline } from "react-native-maps";

import { Button } from "./ui";
import { colors, fonts, radius, shadow } from "../theme/colors";
import { openMaps } from "../utils/format";

function validPoint(point) {
  return point && Number.isFinite(Number(point.latitude)) && Number.isFinite(Number(point.longitude));
}

function toPoint(point) {
  return { latitude: Number(point.latitude), longitude: Number(point.longitude) };
}

export default function TrackingCard({ order, address, navigate = false, showDestination = true }) {
  const mapRef = useRef(null);
  const [destination, setDestination] = useState(null);
  const riderLocation = validPoint(order?.riderLocation) ? toPoint(order.riderLocation) : null;

  useEffect(() => {
    let cancelled = false;
    async function resolveAddress() {
      if (!address || !showDestination) return;
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== "granted") return;
        const results = await Location.geocodeAsync(address);
        const first = results?.[0];
        if (!cancelled && first && Number.isFinite(first.latitude) && Number.isFinite(first.longitude)) {
          setDestination({ latitude: first.latitude, longitude: first.longitude });
        }
      } catch (_) {
        // A map is still useful with the live rider marker when geocoding is unavailable.
      }
    }
    resolveAddress();
    return () => { cancelled = true; };
  }, [address, showDestination]);

  const coordinates = useMemo(() => [riderLocation, destination].filter(Boolean), [riderLocation, destination]);
  const initialRegion = riderLocation
    ? { ...riderLocation, latitudeDelta: 0.018, longitudeDelta: 0.018 }
    : destination
    ? { ...destination, latitudeDelta: 0.018, longitudeDelta: 0.018 }
    : { latitude: 11.0168, longitude: 76.9558, latitudeDelta: 0.08, longitudeDelta: 0.08 };

  useEffect(() => {
    if (!mapRef.current || coordinates.length < 2) return;
    const timer = setTimeout(() => {
      mapRef.current?.fitToCoordinates(coordinates, {
        edgePadding: { top: 70, right: 40, bottom: 80, left: 40 },
        animated: true,
      });
    }, 150);
    return () => clearTimeout(timer);
  }, [order?.riderLocation?.updatedAt, destination]);

  const updatedAt = order?.riderLocation?.updatedAt ? new Date(order.riderLocation.updatedAt) : null;
  const fresh = updatedAt && Number.isFinite(updatedAt.getTime()) && Date.now() - updatedAt.getTime() < 30000;

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>Live Delivery</Text>
          <Text style={styles.title}>{fresh ? "Rider is on the way" : "Waiting for Rider Location"}</Text>
        </View>
        <View style={[styles.livePill, !fresh && styles.waitPill]}>
          <View style={[styles.liveDot, { backgroundColor: fresh ? colors.good : colors.primary }]} />
          <Text style={[styles.liveText, !fresh && styles.waitText]}>{fresh ? "Live" : "Updating"}</Text>
        </View>
      </View>

      <View style={styles.mapWrap}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={initialRegion}
          showsUserLocation={false}
          showsCompass={false}
          toolbarEnabled={false}
          mapType="standard"
        >
          {riderLocation ? (
            <Marker coordinate={riderLocation} title={order?.rider?.name || order?.riderName || "Rider"} description="Live Rider Location">
              <View style={styles.riderMarker}><Icon name="navigation" size={18} color="#FFFFFF" /></View>
            </Marker>
          ) : null}
          {destination ? (
            <Marker coordinate={destination} title="Delivery Address">
              <View style={styles.destinationMarker}><Text style={styles.destinationEmoji}>⌂</Text></View>
            </Marker>
          ) : null}
          {riderLocation && destination ? (
            <Polyline coordinates={[riderLocation, destination]} strokeColor={colors.primary} strokeWidth={5} />
          ) : null}
        </MapView>

        {!riderLocation ? (
          <View style={styles.waitOverlay} pointerEvents="none">
            <View style={styles.waitIcon}><Icon name="truck" size={22} /></View>
            <Text style={styles.waitTitle}>Rider location will appear here</Text>
            <Text style={styles.waitSub}>The map updates automatically when the rider starts sharing GPS.</Text>
          </View>
        ) : null}

        <View style={styles.mapBadge}>
          <Text style={styles.mapBadgeText}>{order?.rider?.name || order?.riderName || "Delivery Rider"}</Text>
          {order?.eta ? <Text style={styles.mapEta}>ETA {order.eta}</Text> : null}
        </View>
      </View>

      <View style={styles.routeInfo}>
        <View style={styles.routeLine}>
          <View style={styles.routeDotBlue} />
          <View style={styles.routeDash} />
          <View style={styles.routeDotDestination} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.routeTitle}>Your delivery is moving in real time</Text>
          <Text style={styles.routeAddress}>{address || "Your delivery address"}</Text>
          {updatedAt && Number.isFinite(updatedAt.getTime()) ? (
            <Text style={styles.updated}>Last updated {updatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text>
          ) : null}
        </View>
      </View>

      {navigate && address ? (
        <Button title="Open in Maps" icon="navigation" small variant="soft" onPress={() => openMaps(address)} style={{ marginTop: 12 }} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: colors.canLine, ...shadow.card },
  topRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  eyebrow: { fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 1.1, color: colors.primary },
  title: { fontFamily: fonts.display, fontSize: 18, color: colors.primaryDark, marginTop: 2 },
  livePill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.primaryDarkBg, paddingHorizontal: 9, paddingVertical: 6, borderRadius: radius.pill },
  waitPill: { backgroundColor: colors.can },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  liveText: { fontFamily: fonts.bodyBold, fontSize: 10, color: colors.primary },
  waitText: { color: colors.primary },
  mapWrap: { height: 245, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.can },
  map: { flex: 1 },
  riderMarker: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.primary, borderWidth: 3, borderColor: "#fff", alignItems: "center", justifyContent: "center", ...shadow.lift },
  riderEmoji: { fontSize: 23 },
  destinationMarker: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primaryDark, borderWidth: 3, borderColor: "#fff", alignItems: "center", justifyContent: "center" },
  destinationEmoji: { color: "#fff", fontSize: 23, fontFamily: fonts.bodyBold },
  mapBadge: { position: "absolute", left: 12, top: 12, backgroundColor: "rgba(255,255,255,0.96)", borderRadius: 12, paddingHorizontal: 11, paddingVertical: 8, ...shadow.card },
  mapBadgeText: { fontFamily: fonts.bodyBold, color: colors.primaryDark, fontSize: 12 },
  mapEta: { fontFamily: fonts.bodySemi, color: colors.primary, fontSize: 10.5, marginTop: 2 },
  waitOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(243,248,250,0.9)", paddingHorizontal: 34 },
  waitIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  waitTitle: { fontFamily: fonts.display, fontSize: 16, color: colors.primaryDark, textAlign: "center" },
  waitSub: { fontFamily: fonts.body, fontSize: 12, lineHeight: 18, color: colors.inkSoft, textAlign: "center", marginTop: 4 },
  routeInfo: { flexDirection: "row", gap: 12, marginTop: 14, paddingHorizontal: 2 },
  routeLine: { width: 16, alignItems: "center", paddingTop: 3 },
  routeDotBlue: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  routeDash: { width: 2, height: 22, borderRadius: 1, backgroundColor: colors.canLine },
  routeDotDestination: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primaryDark },
  routeTitle: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.primaryDark },
  routeAddress: { fontFamily: fonts.body, fontSize: 12, color: colors.inkSoft, marginTop: 2, lineHeight: 17 },
  updated: { fontFamily: fonts.bodyMedium, fontSize: 10.5, color: colors.inkFaint, marginTop: 3 },
});
