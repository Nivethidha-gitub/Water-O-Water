import React, { useEffect, useRef, useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { LanguageToggle, Text } from "../../i18n";
import Icon from "../../components/Icon";
import IdUploadForm, { validateId } from "../../components/IdUploadForm";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScrollView, KeyboardAvoidingView, Platform } from "react-native";

import api, { errorField, errorMessage, getServerUrl, saveServerUrl } from "../../api/client";
import { getPublicSuppliers, sendSignupOtp, verifySignupOtp } from "../../api/auth";
import { useAuth } from "../../context/AuthContext";
import { Button, Chip, Field } from "../../components/ui";
import { colors, fonts, radius, shadow } from "../../theme/colors";

/*
 * Sign in / Sign up for every role. Mirrors the web prototype's login:
 * Sign In | Sign Up tabs, "Signing in as" role cards, show/hide password,
 * and (in development) one-tap demo accounts. The role the server reports for
 * the account decides which app opens (see AppNavigator).
 */

const ROLES = [
  { id: "CUSTOMER", icon: "droplet", title: "Customer", hint: "Order water cans" },
  { id: "SUPPLIER", icon: "briefcase", title: "Supplier", hint: "Receive & deliver orders" },
  { id: "RIDER", icon: "truck", title: "Rider", hint: "Deliver cans to doorsteps" },
];

const DEMO = [
  { label: "Demo Customer", identifier: "customer@wow.test", role: "CUSTOMER" },
  { label: "Demo Supplier", identifier: "murugan@wow.test", role: "SUPPLIER" },
  { label: "Demo Rider", identifier: "rider@wow.test", role: "RIDER" },
];
const DEMO_PASSWORD = "Water@123";

const EMPTY = {
  name: "", businessName: "", email: "", phone: "", address: "",
  vehicleNo: "", supplierId: "", password: "", confirm: "",
  idType: "", idNumber: "", idPhoto: "", idUri: "", // riders: one government photo ID
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validate(mode, role, f) {
  const e = {};
  if (mode === "signin") {
    if (!f.email.trim()) e.email = "Enter your email or phone number";
    if (!f.password) e.password = "Enter your password";
    return e;
  }
  if (f.name.trim().length < 2) e.name = "Enter your name";
  if (role === "SUPPLIER" && f.businessName.trim().length < 2) e.businessName = "Enter your business name";
  const email = f.email.trim();
  const phone = f.phone.trim();
  if (!email && !phone) e.email = "Enter an email address or phone number";
  if (email && !EMAIL_RE.test(email)) e.email = "Enter a valid email address";
  if (!phone) e.phone = "A phone number is required for signup OTP";
  else if (!/^\+[1-9]\d{7,14}$/.test(phone)) e.phone = "Use international format, e.g. +919876543210";
  if (role === "RIDER" && !f.supplierId) e.supplierId = "Choose the supplier you deliver for";
  if (role === "RIDER") Object.assign(e, validateId(f));
  if (f.password.length < 8) e.password = "At least 8 characters";
  else if (!/[A-Za-z]/.test(f.password) || !/\d/.test(f.password)) e.password = "Use letters and numbers";
  if (f.confirm !== f.password) e.confirm = "Passwords do not match";
  return e;
}

export default function AuthScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { login, register } = useAuth();

  const [mode, setMode] = useState(route?.params?.mode === "signup" ? "signup" : "signin");
  const [role, setRole] = useState("CUSTOMER");
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpBusy, setOtpBusy] = useState(false);

  const [suppliers, setSuppliers] = useState(null); // null = not loaded
  const [suppliersError, setSuppliersError] = useState("");

  const [showServer, setShowServer] = useState(false);
  const [server, setServer] = useState(getServerUrl());
  const [serverNote, setServerNote] = useState(null); // { ok, text }
  const [testing, setTesting] = useState(false);

  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const isSignup = mode === "signup";

  // Riders pick the supplier they deliver for - load the public list when needed.
  const loadSuppliers = async () => {
    setSuppliersError("");
    try {
      const list = await getPublicSuppliers();
      if (mounted.current) setSuppliers(list);
    } catch (error) {
      if (mounted.current) setSuppliersError(errorMessage(error, "Could not load suppliers."));
    }
  };
  useEffect(() => {
    if (isSignup && role === "RIDER" && suppliers === null) loadSuppliers();
  }, [isSignup, role]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (key) => (value) => {
    setForm((c) => ({ ...c, [key]: value }));
    setErrors((c) => ({ ...c, [key]: undefined }));
    if (key === "phone") {
      // A verified OTP belongs to one exact phone number; editing it invalidates verification.
      setOtp(""); setOtpSent(false); setOtpVerified(false);
    }
  };

  const switchMode = (next) => {
    setMode(next);
    setErrors({});
    setFormError("");
    setForm(EMPTY);
    setOtp(""); setOtpSent(false); setOtpVerified(false);
  };

  const submit = async () => {
    const found = validate(mode, role, form);
    if (mode === "signup" && !otpVerified) found.otp = "Verify your phone number with OTP before signing up";
    setErrors(found);
    setFormError("");
    if (Object.keys(found).length) return;

    setBusy(true);
    try {
      if (mode === "signin") {
        await login(form.email.trim(), form.password, role);
      } else {
        await register({
          role,
          name: form.name.trim(),
          businessName: role === "SUPPLIER" ? form.businessName.trim() : undefined,
          email: form.email.trim(),
          phone: form.phone.trim(),
          address: form.address.trim(),
          supplierId: role === "RIDER" ? form.supplierId : undefined,
          vehicleNo: role === "RIDER" ? form.vehicleNo.trim() : undefined,
          idType: role === "RIDER" ? form.idType : undefined,
          idNumber: role === "RIDER" ? form.idNumber.trim() : undefined,
          idPhoto: role === "RIDER" ? form.idPhoto : undefined,
          password: form.password,
        });
      }
      // Signed in: the navigator now opens the screen for the account's role.
    } catch (error) {
      const field = errorField(error);
      const message = errorMessage(error, "Could not sign you in. Please try again.");
      if (field && field !== "role") setErrors({ [field === "identifier" ? "email" : field]: message });
      else setFormError(message);
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  const requestOtp = async () => {
    const phone = form.phone.trim();
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
      setErrors((e) => ({ ...e, phone: "Use international format, e.g. +919876543210" }));
      return;
    }
    setOtpBusy(true); setFormError("");
    try { await sendSignupOtp(phone); setOtpSent(true); setOtpVerified(false); setFormError("OTP sent by SMS. Check your messages."); }
    catch (e) { setFormError(errorMessage(e, "Could not send OTP. Check server SMS configuration.")); }
    finally { setOtpBusy(false); }
  };

  const confirmOtp = async () => {
    setOtpBusy(true); setFormError("");
    try { await verifySignupOtp(form.phone.trim(), otp.trim()); setOtpVerified(true); setFormError("Phone verified successfully."); }
    catch (e) { setFormError(errorMessage(e, "OTP verification failed.")); }
    finally { setOtpBusy(false); }
  };

  const fillDemo = (demo) => {
    setMode("signin");
    setRole(demo.role);
    setForm({ ...EMPTY, email: demo.identifier, password: DEMO_PASSWORD });
    setOtp(""); setOtpSent(false); setOtpVerified(false);
    setErrors({});
    setFormError("");
  };

  const saveServer = async () => {
    const applied = await saveServerUrl(server);
    setServer(applied);
    setServerNote({ ok: true, text: "Saved." });
  };

  const testServer = async () => {
    setTesting(true);
    setServerNote(null);
    try {
      const applied = await saveServerUrl(server);
      setServer(applied);
      await api.get("/health", { timeout: 6000 });
      setServerNote({ ok: true, text: `Connected to ${applied} ✓` });
      if (isSignup && role === "RIDER") loadSuppliers();
    } catch (error) {
      setServerNote({ ok: false, text: errorMessage(error, "Could not connect.") });
    } finally {
      setTesting(false);
    }
  };

  const pwToggle = (
    <Pressable onPress={() => setShowPw((v) => !v)} hitSlop={8} style={{ paddingHorizontal: 8 }}>
      <Text style={styles.show}>{showPw ? "Hide" : "Show"}</Text>
    </Pressable>
  );

  const placeholders = {
    address: role === "SUPPLIER" ? "e.g. RS Puram, Coimbatore" : "e.g. Anna Nagar, Chennai",
  };

  const submitLabel = isSignup
    ? `Create ${role === "SUPPLIER" ? "supplier" : role === "RIDER" ? "rider" : "customer"} account`
    : "Sign In";

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}>
        {/* reference-style logo header */}
        <View style={[styles.hero, { paddingTop: insets.top + 18 }]}>
          <LanguageToggle tone="light" style={{ position: "absolute", right: 16, top: insets.top + 12 }} />
          {navigation && navigation.canGoBack() ? (
            <Pressable onPress={() => navigation.goBack()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Go back"
              style={{ position: "absolute", left: 16, top: insets.top + 10, width: 40, height: 40, borderRadius: 14, backgroundColor: colors.can, alignItems: "center", justifyContent: "center" }}>
              <Icon name="arrow-left" size={20} color={colors.primaryDark} />
            </Pressable>
          ) : null}
          <Image source={require("../../../assets/brand-mark.png")} style={styles.authLogo} resizeMode="contain" />
          <Text style={styles.logoWordmark}>Water'O'Water</Text>
          <Text style={styles.logoTag}>Pure Water  •  Healthy Life</Text>
        </View>

        {/* card */}
        <View style={styles.card}>
          <View style={styles.tabs}>
            {[["signin", "Sign In"], ["signup", "Sign Up"]].map(([key, label]) => {
              const active = mode === key;
              return (
                <Pressable key={key} onPress={() => switchMode(key)} style={[styles.tab, active && styles.tabActive]} accessibilityRole="tab" accessibilityState={{ selected: active }}>
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.h2}>{isSignup ? "Create Your Account" : "Welcome Back"}</Text>
          <Text style={styles.sub}>
            {isSignup ? "Choose how you will use Water'O'Water." : "Sign in to continue to your dashboard."}
          </Text>

          <Text style={styles.label}>{isSignup ? "I Am a" : "Signing In As"}</Text>
          <View style={styles.roles}>
            {ROLES.map((r) => {
              const active = role === r.id;
              return (
                <Pressable key={r.id} onPress={() => { setRole(r.id); setFormError(""); }} style={[styles.role, active && styles.roleActive]} accessibilityRole="button" accessibilityState={{ selected: active }}>
                  <Icon name={r.icon} size={22} color={active ? colors.primary : colors.inkSoft} />
                  <Text style={styles.roleTitle}>{r.title}</Text>
                  <Text style={styles.roleHint}>{r.hint}</Text>
                </Pressable>
              );
            })}
          </View>

          {formError ? (
            <View style={styles.errorBox}><Text style={styles.errorText}>{formError}</Text></View>
          ) : null}

          {isSignup && (
            <Field label="Full Name" value={form.name} onChangeText={set("name")} placeholder="Your name" autoComplete="name" error={errors.name} />
          )}
          {isSignup && role === "SUPPLIER" && (
            <Field label="Business Name" value={form.businessName} onChangeText={set("businessName")} placeholder="e.g. Murugan Water" error={errors.businessName} />
          )}

          <Field
            label={isSignup ? "Email" : "Email or Phone"}
            value={form.email}
            onChangeText={set("email")}
            placeholder={isSignup ? "you@example.com" : "you@example.com or 98765 43210"}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType={isSignup ? "email-address" : "default"}
            autoComplete={isSignup ? "email" : "username"}
            error={errors.email}
          />

          {isSignup && (
            <Field
              label="Phone"
              value={form.phone}
              onChangeText={set("phone")}
              placeholder="+919876543210"
              keyboardType="phone-pad"
              autoComplete="tel"
              error={errors.phone}
            />
          )}
          {isSignup && (
            <>
              <Button title={otpBusy ? "Please wait…" : otpSent ? "Resend OTP" : "Send OTP by SMS"} onPress={requestOtp} busy={otpBusy} variant="outline" style={{ marginBottom: 10 }} />
              {otpSent && !otpVerified ? <>
                <Field label="SMS Verification Code" value={otp} onChangeText={setOtp} placeholder="Enter OTP" keyboardType="number-pad" error={errors.otp} />
                <Button title="Verify OTP" onPress={confirmOtp} busy={otpBusy} style={{ marginBottom: 12 }} />
              </> : null}
              {otpVerified ? <Text style={{ color: colors.primary, marginBottom: 10, fontFamily: fonts.bodySemi }}>✓ Phone number verified</Text> : null}
            </>
          )}

          {isSignup && role !== "RIDER" && (
            <Field
              label={role === "SUPPLIER" ? "Service Area" : "Delivery Address"}
              value={form.address}
              onChangeText={set("address")}
              placeholder={placeholders.address}
              error={errors.address}
            />
          )}

          {isSignup && role === "RIDER" && (
            <>
              <Text style={styles.fieldLabel}>I Deliver for</Text>
              {suppliers === null && !suppliersError ? (
                <Text style={styles.muted}>Loading suppliers…</Text>
              ) : suppliersError ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{suppliersError}</Text>
                  <Pressable onPress={loadSuppliers}><Text style={styles.retry}>Try Again</Text></Pressable>
                </View>
              ) : suppliers.length === 0 ? (
                <Text style={styles.muted}>No suppliers are available yet.</Text>
              ) : (
                <View style={styles.chips}>
                  {suppliers.map((s) => (
                    <Chip key={s.id} label={s.name} active={form.supplierId === s.id} onPress={() => set("supplierId")(s.id)} />
                  ))}
                </View>
              )}
              {errors.supplierId ? <Text style={styles.err}>{errors.supplierId}</Text> : null}
              <View style={{ height: 14 }} />
              <Field
                label="Vehicle Number"
                value={form.vehicleNo}
                onChangeText={set("vehicleNo")}
                placeholder="e.g. TN 37 DJ 0222"
                autoCapitalize="characters"
                error={errors.vehicleNo}
              />
              <View style={{ height: 14 }} />
              <IdUploadForm value={form} onChange={(patch) => setForm((f) => ({ ...f, ...patch }))} errors={errors} />
              <View style={{ height: 14 }} />
            </>
          )}

          <Field
            label="Password"
            value={form.password}
            onChangeText={set("password")}
            placeholder={isSignup ? "At least 8 characters" : "Your password"}
            secureTextEntry={!showPw}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete={isSignup ? "new-password" : "current-password"}
            right={pwToggle}
            error={errors.password}
          />

          {isSignup && (
            <Field
              label="Confirm Password"
              value={form.confirm}
              onChangeText={set("confirm")}
              secureTextEntry={!showPw}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="new-password"
              error={errors.confirm}
            />
          )}

          <Button title={busy ? "Please wait…" : submitLabel} onPress={submit} busy={busy} disabled={isSignup && !otpVerified} style={{ marginTop: 6 }} />

          <View style={styles.switchRow}>
            <Text style={styles.switchText}>{isSignup ? "Already have an account? " : "New to Water'O'Water? "}</Text>
            <Pressable onPress={() => switchMode(isSignup ? "signin" : "signup")} hitSlop={8}>
              <Text style={styles.switchLink}>{isSignup ? "Sign In" : "Sign Up"}</Text>
            </Pressable>
          </View>

          {/* server address (needed on a real phone) */}
          <View style={styles.server}>
            <Pressable onPress={() => setShowServer((v) => !v)} hitSlop={8}>
              <Text style={styles.serverToggle}>{showServer ? "Hide Server Settings" : "Server Settings"}</Text>
            </Pressable>
            {showServer && (
              <View style={{ marginTop: 10 }}>
                <Field
                  label="Server Address"
                  value={server}
                  onChangeText={(v) => { setServer(v); setServerNote(null); }}
                  placeholder="https://your-public-api.example.com"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  style={{ marginBottom: 6 }}
                />
                <Text style={styles.muted}>For shared use, enter the team's public HTTPS API URL. Everyone must use the same deployed server; localhost and 192.168.x.x work only on a local network.</Text>
                {serverNote ? (
                  <Text style={[styles.serverNote, { color: serverNote.ok ? colors.good : colors.danger }]}>{serverNote.text}</Text>
                ) : null}
                <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
                  <Button title="Save" variant="outline" small onPress={saveServer} style={{ flex: 1 }} />
                  <Button title="Test Connection" variant="soft" small onPress={testServer} busy={testing} style={{ flex: 1.4 }} />
                </View>
              </View>
            )}
          </View>

          {__DEV__ && !isSignup && (
            <View style={styles.demo}>
              <Text style={styles.demoLabel}>Development Demo Accounts</Text>
              <View style={styles.demoRow}>
                {DEMO.map((d) => (
                  <Pressable key={d.identifier} onPress={() => fillDemo(d)} style={styles.demoBtn}>
                    <Text style={styles.demoText}>{d.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </View>
        <Text style={styles.copyright}>Copyrights by Fyneer Technologies</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", backgroundColor: colors.bg, paddingHorizontal: 22, paddingBottom: 8 },
  authLogo: { width: 72, height: 72, marginBottom: 6 },
  logoWordmark: { fontFamily: fonts.displayBold, fontSize: 25, color: colors.primaryDark },
  logoTag: { fontFamily: fonts.body, fontSize: 11.5, color: colors.inkSoft, marginTop: 2 },

  card: {
    marginHorizontal: 16,
    marginTop: 4,
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E2ECF4",
    ...shadow.card,
  },
  tabs: { flexDirection: "row", backgroundColor: "#F0F6FB", borderRadius: radius.pill, padding: 4, marginBottom: 20 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: radius.pill },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.inkSoft },
  tabTextActive: { color: "#fff" },
  h2: { fontFamily: fonts.displayBold, fontSize: 22, color: colors.ink, marginTop: 2 },
  sub: { fontFamily: fonts.body, fontSize: 12.5, color: colors.inkSoft, marginTop: 3, marginBottom: 18 },
  label: { fontFamily: fonts.bodyBold, fontSize: 10.5, letterSpacing: 0.5, color: colors.primaryDark, marginBottom: 8 },
  roles: { flexDirection: "row", gap: 8, marginBottom: 16 },
  role: { flex: 1, minHeight: 82, borderRadius: 12, borderWidth: 1, borderColor: "#D9E7F1", backgroundColor: "#fff", alignItems: "center", justifyContent: "center", padding: 7 },
  roleActive: { borderColor: colors.primary, backgroundColor: colors.can },
  roleIcon: { fontSize: 23, marginBottom: 3 },
  roleTitle: { fontFamily: fonts.bodyBold, fontSize: 11.5, color: colors.ink },
  roleHint: { fontFamily: fonts.body, fontSize: 9.5, color: colors.inkSoft, textAlign: "center", marginTop: 1 },
  errorBox: { backgroundColor: "#F3F8FC", borderRadius: 10, padding: 10, marginBottom: 12 },
  errorText: { color: colors.primaryDark, fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18 },
  fieldLabel: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.ink, marginBottom: 6 },
  muted: { fontFamily: fonts.body, fontSize: 12.5, color: colors.inkSoft },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  err: { fontFamily: fonts.body, fontSize: 12, color: colors.danger, marginTop: 5 },
  retry: { fontFamily: fonts.bodyBold, color: colors.primary, marginTop: 6 },
  show: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.primary },
  switchRow: { flexDirection: "row", justifyContent: "center", marginTop: 16 },
  switchText: { fontFamily: fonts.body, fontSize: 12.5, color: colors.inkSoft },
  switchLink: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: colors.primary },
  server: { marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: "#E9F0F5" },
  serverToggle: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.primary, textAlign: "center" },
  serverNote: { fontFamily: fonts.bodySemi, fontSize: 11.5, marginTop: 6 },
  demo: { marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: "#E9F0F5" },
  demoLabel: { fontFamily: fonts.bodyBold, fontSize: 10.5, color: colors.inkSoft, marginBottom: 8 },
  copyright: { fontFamily: fonts.body, fontSize: 10.5, color: colors.inkSoft, textAlign: "center", marginTop: 16, marginBottom: 10, paddingHorizontal: 16 },
});
