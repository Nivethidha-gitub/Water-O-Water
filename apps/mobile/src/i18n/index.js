import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text as RNText, View } from "react-native";

import { getItem, setItem } from "../utils/storage";
import ta from "./ta";

/*
 * Tamil / English.
 *
 * Every screen writes plain English. The `Text` exported from here looks each
 * string up in the Tamil dictionary (./ta.js) when the app language is Tamil,
 * so no screen has to be rewritten per language and a switch is instant.
 *
 *  - Exact strings:      "Checkout"                    -> "செக்அவுட்"
 *  - Strings with data:  "Order #{code}" matches "Order #AR-10007"; {code} is
 *                        carried across into the Tamil text.
 *  - Lookups ignore letter case, so "Order Summary" and "Order summary" match.
 *  - A string with no Tamil entry is shown as is (never blank).
 */

export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "ta", label: "தமிழ்" },
];

const STORAGE_KEY = "wow.language";
const norm = (s) => String(s).trim().replace(/\s+/g, " ").toLowerCase();
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const exact = new Map();
const patterns = [];
for (const [en, tamil] of Object.entries(ta)) {
  if (/\{\w+\}/.test(en)) {
    const parts = en.split(/\{(\w+)\}/); // literal, name, literal, name, ...
    const names = [];
    let source = "^";
    parts.forEach((part, i) => {
      if (i % 2 === 0) source += escapeRe(part.replace(/\s+/g, " ").toLowerCase());
      else { names.push(part); source += "(.+?)"; }
    });
    patterns.push({ re: new RegExp(source + "$", "i"), names, tamil, weight: en.replace(/\{\w+\}/g, "").length });
  } else {
    exact.set(norm(en), tamil);
  }
}
patterns.sort((a, b) => b.weight - a.weight);

const MONTHS_TA = { Jan: "ஜன", Feb: "பிப்", Mar: "மார்", Apr: "ஏப்", May: "மே", Jun: "ஜூன்", Jul: "ஜூலை", Aug: "ஆக", Sep: "செப்", Oct: "அக்", Nov: "நவ", Dec: "டிச" };
const MONTH_RE = new RegExp(`\\b(${Object.keys(MONTHS_TA).join("|")})\\b`, "g");

let current = "en";

// A value captured by a {placeholder}: translate it, or each item of a "Mon, Wed" style list.
function translateValue(v) {
  const direct = t(v);
  if (direct !== v || !v.includes(", ")) return direct;
  return v.split(", ").map((part) => t(part)).join(", ");
}

export const getLanguage = () => current;

/** Translate one string into the current language. Safe to call anywhere. */
export function t(text, vars) {
  if (typeof text !== "string" || !text) return text;
  let out = text;
  if (current === "ta") {
    const key = norm(text);
    if (exact.has(key)) out = exact.get(key);
    else {
      let hit = null;
      for (const p of patterns) {
        const m = key.length ? text.trim().replace(/\s+/g, " ").match(p.re) : null;
        if (m) {
          hit = p.tamil.replace(/\{(\w+)\}/g, (_, name) => {
            const idx = p.names.indexOf(name);
            return idx >= 0 ? translateValue(m[idx + 1]) : "";
          });
          break;
        }
      }
      out = hit != null ? hit : text.replace(MONTH_RE, (mo) => MONTHS_TA[mo]);
    }
  }
  if (vars) out = out.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : ""));
  return out;
}

const LanguageContext = createContext({ lang: "en", setLanguage: () => {} });

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState("en");

  useEffect(() => {
    getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved === "ta" || saved === "en") { current = saved; setLang(saved); }
      })
      .catch(() => {});
  }, []);

  const setLanguage = useCallback((code) => {
    if (code !== "ta" && code !== "en") return;
    current = code;
    setLang(code);
    setItem(STORAGE_KEY, code).catch(() => {});
  }, []);

  const value = useMemo(() => ({ lang, setLanguage }), [lang, setLanguage]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

/** Subscribes a component to language changes. */
export const useLanguage = () => useContext(LanguageContext);

function localize(children) {
  if (typeof children === "string") return t(children);
  if (Array.isArray(children)) {
    const flat = children.flat(Infinity);
    if (flat.every((c) => typeof c === "string" || typeof c === "number")) return t(flat.join(""));
    return flat.map((c) => (typeof c === "string" ? t(c) : c));
  }
  return children;
}

/** Drop-in replacement for React Native's Text that translates its content. */
export function Text({ children, ...props }) {
  useLanguage(); // re-render this text when the language changes
  return <RNText {...props}>{localize(children)}</RNText>;
}

/** Small pill that flips between English and Tamil (shows the language you can switch to). */
export function LanguageToggle({ tone = "dark", style }) {
  const { lang, setLanguage } = useLanguage();
  const next = lang === "en" ? "ta" : "en";
  const label = "English / தமிழ்"; // the pill shows both, as in the design
  const dark = tone === "dark";
  return (
    <Pressable
      onPress={() => setLanguage(next)}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={lang === "en" ? "மொழியை தமிழுக்கு மாற்று" : "Switch language to English"}
      style={[styles.toggle, dark ? styles.toggleDark : styles.toggleLight, style]}
    >
      <RNText style={[styles.toggleText, { color: dark ? "#FFFFFF" : "#075A78" }]}>{label}</RNText>
    </Pressable>
  );
}

/** Two-option selector for settings screens. */
export function LanguageSwitch({ style }) {
  const { lang, setLanguage } = useLanguage();
  return (
    <View style={[styles.switch, style]}>
      {LANGUAGES.map((l) => {
        const active = l.code === lang;
        return (
          <Pressable key={l.code} onPress={() => setLanguage(l.code)} style={[styles.option, active && styles.optionOn]} accessibilityRole="radio" accessibilityState={{ selected: active }}>
            <RNText style={[styles.optionText, active && { color: "#FFFFFF" }]}>{l.label}</RNText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  toggle: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6, borderWidth: 1 },
  toggleDark: { backgroundColor: "rgba(255,255,255,.13)", borderColor: "rgba(255,255,255,.28)" },
  toggleLight: { backgroundColor: "#E4F5FA", borderColor: "#C5E7F0" },
  toggleText: { fontFamily: "Inter_600SemiBold", fontSize: 11.5 },
  switch: { flexDirection: "row", backgroundColor: "#F0F7FA", borderRadius: 999, padding: 4, gap: 4 },
  option: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 999 },
  optionOn: { backgroundColor: "#075A78" },
  optionText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#627C8C" },
});
