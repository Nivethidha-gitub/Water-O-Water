import React from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Text, t, useLanguage } from "../i18n";
import Icon from "./Icon";
import AppBar from "./AppBar";

import { LanguageToggle } from "../i18n";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Button from "./PrimaryButton";
import { colors, fonts, radius, shadow } from "../theme/colors";
import { initial, statusMeta } from "../utils/format";

export { Button };

function SafeChildren({ children }) {
  return React.Children.map(children, (child) => {
    if (typeof child === "string" || typeof child === "number") {
      return <Text style={{ color: colors.ink }}>{String(child)}</Text>;
    }
    return child;
  });
}

/*
 * Screen: top bar (back arrow + screen name + language) and an (optionally scrolling) body.
 * Pass `title` / `subtitle` for the bar and `onBack` to override where the arrow goes
 * (by default: the previous page, or Home from a main tab). `hideHeader` removes the bar.
 */
export function Screen({
  title,
  subtitle,
  onBack,
  brand,
  hideHeader = false,
  scroll = true,
  refreshing,
  onRefresh,
  children,
  footer,
  keyboard = false,
  contentStyle,
}) {
  const insets = useSafeAreaInsets();
  const body = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.scrollContent, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        ) : undefined
      }
    >
      <SafeChildren>{children}</SafeChildren>
    </ScrollView>
  ) : (
    <View style={[styles.flex, styles.scrollContent, contentStyle]}><SafeChildren>{children}</SafeChildren></View>
  );

  return (
    <View style={styles.screen}>
      {!hideHeader ? <AppBar title={title} subtitle={subtitle} onBack={onBack} /> : null}
      {keyboard ? (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          {body}
        </KeyboardAvoidingView>
      ) : (
        body
      )}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
}

export function PageTitle({ title, subtitle }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.pageTitle}>{title}</Text>
      {subtitle ? <Text style={styles.pageSub}>{subtitle}</Text> : null}
    </View>
  );
}

export function SectionTitle({ children, right }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.section}>{children}</Text>
      {right}
    </View>
  );
}

export function Card({ children, style, onPress }) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.card, style, pressed && { opacity: 0.9 }]}>
        <SafeChildren>{children}</SafeChildren>
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}><SafeChildren>{children}</SafeChildren></View>;
}

export function StatusBadge({ status, label }) {
  const meta = statusMeta(status);
  return (
    <View style={[styles.badge, { backgroundColor: meta.bg }]}>
      <Text style={[styles.badgeText, { color: meta.fg }]}>{label || meta.label}</Text>
    </View>
  );
}

export function Pill({ text, tone = "info" }) {
  const map = {
    info: [colors.can, colors.primary],
    good: [colors.goodBg, colors.good],
    warn: [colors.warnBg, colors.primaryDark],
    danger: [colors.dangerBg, colors.danger],
  };
  const [bg, fg] = map[tone] || map.info;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{text}</Text>
    </View>
  );
}

export function Avatar({ name, size = 44, tone }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: tone || colors.can,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ fontFamily: fonts.display, fontSize: size * 0.4, color: colors.primary }}>{initial(name)}</Text>
    </View>
  );
}

export function Field({ label, error, right, style, inputStyle, ...input }) {
  useLanguage();
  if (typeof input.placeholder === "string") input = { ...input, placeholder: t(input.placeholder) };
  return (
    <View style={[{ marginBottom: 14 }, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View>
        <TextInput
          placeholderTextColor={colors.inkFaint}
          {...input}
          style={[styles.input, error && styles.inputError, right && { paddingRight: 64 }, inputStyle]}
        />
        {right ? <View style={styles.inputRight}>{right}</View> : null}
      </View>
      {error ? <Text style={styles.err}>{error}</Text> : null}
    </View>
  );
}

/** Pill-shaped tab switcher (Sign In | Sign Up, New | Accepted | All ...). */
export function Segmented({ options, value, onChange, style }) {
  return (
    <View style={[styles.segmented, style]}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={[styles.segment, active && styles.segmentActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({ label, active, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function Stepper({ value, onChange, min = 0, max = 100 }) {
  return (
    <View style={styles.stepper}>
      <Pressable
        onPress={() => onChange(Math.max(min, value - 1))}
        style={[styles.stepBtn, { backgroundColor: colors.can }]}
        hitSlop={6}
        accessibilityLabel="Decrease quantity"
      >
        <Text style={[styles.stepText, { color: colors.primaryDark }]}>−</Text>
      </Pressable>
      <Text style={styles.stepValue}>{value}</Text>
      <Pressable
        onPress={() => onChange(Math.min(max, value + 1))}
        style={[styles.stepBtn, { backgroundColor: colors.primaryDark }]}
        hitSlop={6}
        accessibilityLabel="Increase quantity"
      >
        <Text style={[styles.stepText, { color: "#fff" }]}>+</Text>
      </Pressable>
    </View>
  );
}

/**
 * Radio buttons: one choice from a short list. Each option is a full-width row
 * with a round radio, a title and an optional detail line.
 * options: [{ key, title, detail?, icon? }]
 */
export function RadioGroup({ options, value, onChange, style }) {
  return (
    <View style={[styles.radioGroup, style]} accessibilityRole="radiogroup">
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={[styles.radioRow, on && styles.radioRowOn]}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={o.title}
          >
            <View style={[styles.radioOuter, on && styles.radioOuterOn]}>{on ? <View style={styles.radioInner} /> : null}</View>
            {o.icon ? <Icon name={o.icon} size={22} /> : null}
            <View style={{ flex: 1 }}>
              <Text style={styles.radioTitle}>{o.title}</Text>
              {o.detail ? <Text style={styles.radioDetail}>{o.detail}</Text> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Row({ label, value, bold, valueColor }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, bold && { fontFamily: fonts.bodyBold, color: colors.primaryDark }, valueColor && { color: valueColor }]}>
        {value}
      </Text>
    </View>
  );
}

export function EmptyState({ icon = "droplet", title, text, action }) {
  return (
    <View style={styles.empty}>
      <View style={{ marginBottom: 6 }}><Icon name={icon} size={34} /></View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {text ? <Text style={styles.emptyText}>{text}</Text> : null}
      {action ? <View style={{ marginTop: 16, alignSelf: "stretch" }}>{action}</View> : null}
    </View>
  );
}

export function Loading({ label }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={colors.primary} />
      {label ? <Text style={styles.loadingText}>{label}</Text> : null}
    </View>
  );
}

export function ErrorBanner({ message, onRetry }) {
  if (!message) return null;
  return (
    <View style={styles.errorBanner}>
      <Text style={styles.errorText}>{message}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} hitSlop={8}>
          <Text style={styles.retry}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  languageHeader: { minHeight: 44, paddingHorizontal: 16, paddingBottom: 8, alignItems: "flex-end", justifyContent: "center", backgroundColor: colors.bg },
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 34 },
  footer: {
    padding: 16,
    paddingBottom: 18,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: "#E3EEF2",
  },

  pageTitle: { fontFamily: fonts.displayBold, fontSize: 22, color: colors.ink },
  pageSub: { fontFamily: fonts.body, fontSize: 13.5, color: colors.inkSoft, marginTop: 2 },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 20, marginBottom: 10 },
  section: { fontFamily: fonts.displayBold, fontSize: 16, color: colors.ink },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 15,
    borderWidth: 1,
    borderColor: "#DCE9F0",
    marginBottom: 12,
    ...shadow.card,
  },

  badge: { alignSelf: "flex-start", borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontFamily: fonts.bodySemi, fontSize: 11.5 },

  label: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 0.45, color: colors.primaryDark, marginBottom: 7 },
  input: {
    borderRadius: radius.md,
    borderWidth: 1.4,
    borderColor: "#CFE2EC",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.ink,
  },
  inputError: { borderColor: "#D9534F" },
  inputRight: { position: "absolute", right: 6, top: 0, bottom: 0, justifyContent: "center" },
  err: { fontFamily: fonts.body, fontSize: 12, color: colors.danger, marginTop: 5 },

  segmented: { flexDirection: "row", backgroundColor: colors.tabs, borderRadius: radius.pill, padding: 4, gap: 4 },
  segment: { flex: 1, paddingVertical: 10, borderRadius: radius.pill, alignItems: "center" },
  segmentActive: { backgroundColor: colors.primaryDark, ...shadow.lift },
  segmentText: { fontFamily: fonts.bodySemi, fontSize: 13.5, color: colors.inkSoft },
  segmentTextActive: { color: "#fff" },

  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.canLine,
    marginRight: 8,
  },
  chipActive: { backgroundColor: colors.can, borderColor: colors.primary },
  chipText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.inkSoft },
  chipTextActive: { color: colors.primaryDark },

  stepper: { flexDirection: "row", alignItems: "center" },
  stepBtn: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  stepText: { fontFamily: fonts.bodyBold, fontSize: 20, lineHeight: 23 },
  stepValue: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink, minWidth: 34, textAlign: "center" },

  infoRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, gap: 12 },
  infoLabel: { fontFamily: fonts.body, fontSize: 13.5, color: colors.inkSoft, flexShrink: 1 },
  radioGroup: { gap: 9 },
  radioRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#FFFFFF", borderRadius: radius.md + 2, borderWidth: 1.5, borderColor: "#D8E8EF", paddingVertical: 13, paddingHorizontal: 14 },
  radioRowOn: { borderColor: colors.primary, backgroundColor: "#EAF8FC" },
  radioOuter: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.canLine, alignItems: "center", justifyContent: "center" },
  radioOuterOn: { borderColor: colors.primary },
  radioInner: { width: 11, height: 11, borderRadius: 6, backgroundColor: colors.primary },
  radioIcon: { fontSize: 22 },
  radioTitle: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
  radioDetail: { fontFamily: fonts.body, fontSize: 12, color: colors.inkSoft, marginTop: 2 },
  infoValue: { fontFamily: fonts.bodySemi, fontSize: 13.5, color: colors.ink, flexShrink: 1, textAlign: "right" },

  empty: { alignItems: "center", paddingVertical: 48, paddingHorizontal: 24 },
  emptyIcon: { fontSize: 44, marginBottom: 10 },
  emptyTitle: { fontFamily: fonts.display, fontSize: 17, color: colors.primaryDark, textAlign: "center" },
  emptyText: { fontFamily: fonts.body, fontSize: 13.5, color: colors.inkSoft, textAlign: "center", marginTop: 6, lineHeight: 20 },

  loading: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  loadingText: { fontFamily: fonts.body, color: colors.inkSoft, marginTop: 12 },

  errorBanner: {
    backgroundColor: colors.dangerBg,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  errorText: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: "#A93226" },
  retry: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.primaryDark },
});
