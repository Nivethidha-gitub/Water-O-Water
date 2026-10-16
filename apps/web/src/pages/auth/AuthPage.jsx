import React, { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth, homePathFor } from "../../auth/AuthContext";
import * as api from "../../api/client";
import { isNativeApp } from "../../components/format";
import "./auth.css";

const ROLES = [
  { id: "CUSTOMER", icon: "💧", title: "Customer", hint: "Order water cans" },
  { id: "SUPPLIER", icon: "🚚", title: "Supplier", hint: "Receive & deliver orders" },
];

const DEMO = [
  { label: "Demo customer", identifier: "customer@wow.test", role: "CUSTOMER" },
  { label: "Demo supplier", identifier: "murugan@wow.test", role: "SUPPLIER" },
];
const DEMO_PASSWORD = "Water@123";

const EMPTY = {
  name: "", businessName: "", email: "", phone: "", address: "", password: "", confirm: "",
};

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
  const phone = f.phone.replace(/\D/g, "");
  if (!email && !phone) e.email = "Enter an email address or phone number";
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) e.email = "Enter a valid email address";
  if (f.phone && (phone.length < 10 || phone.length > 15)) e.phone = "Enter a valid phone number";
  if (f.password.length < 8) e.password = "At least 8 characters";
  else if (!/[A-Za-z]/.test(f.password) || !/\d/.test(f.password)) e.password = "Use letters and numbers";
  if (f.confirm !== f.password) e.confirm = "Passwords do not match";
  return e;
}

export default function AuthPage() {
  const { user, signIn, signUp } = useAuth();
  const location = useLocation();
  const [mode, setMode] = useState(location.pathname === "/signup" ? "signup" : "signin");
  const [role, setRole] = useState("CUSTOMER");
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [server, setServer] = useState(api.getServerUrl());
  const [showServer, setShowServer] = useState(false);

  // Already signed in: go straight to the dashboard for this account's role.
  if (user) return <Navigate to={homePathFor(user)} replace />;

  const set = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  function switchMode(next) {
    setMode(next);
    setErrors({});
    setFormError("");
    setForm(EMPTY);
  }

  async function submit(event) {
    event.preventDefault();
    const found = validate(mode, role, form);
    setErrors(found);
    setFormError("");
    if (Object.keys(found).length > 0) return;
    api.setServerUrl(server);

    setBusy(true);
    try {
      if (mode === "signin") {
        await signIn({ identifier: form.email.trim(), password: form.password, role });
      } else {
        await signUp({
          role,
          name: form.name.trim(),
          businessName: role === "SUPPLIER" ? form.businessName.trim() : undefined,
          email: form.email.trim(),
          phone: form.phone.trim(),
          address: form.address.trim(),
          password: form.password,
        });
      }
      // The router redirects by the role the server returned.
    } catch (err) {
      if (err.details?.field) setErrors({ [err.details.field === "identifier" ? "email" : err.details.field]: err.message });
      else setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function useDemo(demo) {
    setMode("signin");
    setRole(demo.role);
    setForm({ ...EMPTY, email: demo.identifier, password: DEMO_PASSWORD });
    setErrors({});
    setFormError("");
  }

  const isSignup = mode === "signup";
  const field = (key, label, props = {}) => (
    <div className="au-field">
      <label htmlFor={`au-${key}`}>{label}</label>
      <input
        id={`au-${key}`}
        value={form[key]}
        onChange={set(key)}
        className={errors[key] ? "invalid" : ""}
        {...props}
      />
      {errors[key] && <div className="err">{errors[key]}</div>}
    </div>
  );

  return (
    <div className="au-page">
      <aside className="au-brand">
        <div className="au-logo">
          <div className="au-drop">💧</div>
          <div>
            <strong>WoW</strong>
            <span>Water O Water</span>
          </div>
        </div>
        <div className="au-pitch">
          <h1>Fresh water, delivered by people you trust.</h1>
          <p>One app for households ordering water cans and for suppliers who deliver them.</p>
          <ul className="au-points">
            <li>Order from your chosen supplier in a few taps</li>
            <li>Suppliers are notified the moment an order arrives</li>
            <li>Track every delivery from placed to doorstep</li>
          </ul>
        </div>
        <div className="au-foot">© Water O Water</div>
      </aside>

      <main className="au-panel">
        <form className="au-card" onSubmit={submit} noValidate>
          <div className="au-mobile-logo">
            <div className="au-drop">💧</div>
            <strong>WoW</strong>
          </div>

          <div className="au-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={!isSignup} className={!isSignup ? "active" : ""} onClick={() => switchMode("signin")}>
              Sign In
            </button>
            <button type="button" role="tab" aria-selected={isSignup} className={isSignup ? "active" : ""} onClick={() => switchMode("signup")}>
              Sign Up
            </button>
          </div>

          <h2>{isSignup ? "Create your account" : "Welcome back"}</h2>
          <p className="au-sub">
            {isSignup ? "Choose how you will use Water O Water." : "Sign in to continue to your dashboard."}
          </p>

          <span className="au-label">{isSignup ? "I am a" : "Signing in as"}</span>
          <div className="au-roles">
            {ROLES.map((r) => (
              <button
                type="button"
                key={r.id}
                className={`au-role ${role === r.id ? "active" : ""}`}
                aria-pressed={role === r.id}
                onClick={() => setRole(r.id)}
              >
                <span className="ico">{r.icon}</span>
                <strong>{r.title}</strong>
                <small>{r.hint}</small>
              </button>
            ))}
          </div>

          {formError && <div className="au-error" role="alert">{formError}</div>}

          {isSignup && field("name", "Full name", { autoComplete: "name", placeholder: "Your name" })}
          {isSignup && role === "SUPPLIER" &&
            field("businessName", "Business name", { placeholder: "e.g. Murugan Water" })}

          {field("email", isSignup ? "Email" : "Email or phone", {
            type: isSignup ? "email" : "text",
            autoComplete: isSignup ? "email" : "username",
            placeholder: isSignup ? "you@example.com" : "you@example.com or 98765 43210",
          })}

          {isSignup && field("phone", "Phone (optional if you gave an email)", {
            type: "tel", autoComplete: "tel", placeholder: "98765 43210",
          })}

          {isSignup &&
            field("address", role === "SUPPLIER" ? "Service area (optional)" : "Delivery address (optional)", {
              autoComplete: "street-address",
              placeholder: role === "SUPPLIER" ? "e.g. RS Puram, Coimbatore" : "e.g. Anna Nagar, Chennai",
            })}

          <div className="au-field">
            <label htmlFor="au-password">Password</label>
            <div className="au-pw">
              <input
                id="au-password"
                type={showPw ? "text" : "password"}
                value={form.password}
                onChange={set("password")}
                autoComplete={isSignup ? "new-password" : "current-password"}
                className={errors.password ? "invalid" : ""}
                placeholder={isSignup ? "At least 8 characters" : "Your password"}
              />
              <button type="button" onClick={() => setShowPw((v) => !v)}>{showPw ? "Hide" : "Show"}</button>
            </div>
            {errors.password && <div className="err">{errors.password}</div>}
          </div>

          {isSignup && (
            <div className="au-field">
              <label htmlFor="au-confirm">Confirm password</label>
              <input
                id="au-confirm"
                type={showPw ? "text" : "password"}
                value={form.confirm}
                onChange={set("confirm")}
                autoComplete="new-password"
                className={errors.confirm ? "invalid" : ""}
              />
              {errors.confirm && <div className="err">{errors.confirm}</div>}
            </div>
          )}

          <button className="au-submit" type="submit" disabled={busy}>
            {busy ? "Please wait…" : isSignup ? `Create ${role === "SUPPLIER" ? "supplier" : "customer"} account` : "Sign In"}
          </button>

          <p className="au-switch">
            {isSignup ? "Already have an account? " : "New to Water O Water? "}
            <button type="button" onClick={() => switchMode(isSignup ? "signin" : "signup")}>
              {isSignup ? "Sign In" : "Sign Up"}
            </button>
          </p>

          {isNativeApp() && (
            <div className="au-server">
              <button type="button" className="au-server-toggle" onClick={() => setShowServer((v) => !v)}>
                {showServer ? "Hide server settings" : "Server settings"}
              </button>
              {showServer && (
                <>
                  <label htmlFor="au-server">Server address</label>
                  <input
                    id="au-server"
                    value={server}
                    onChange={(e) => setServer(e.target.value)}
                    onBlur={() => api.setServerUrl(server)}
                    placeholder="http://192.168.1.10:3001"
                    autoCapitalize="none"
                    autoCorrect="off"
                    inputMode="url"
                  />
                  <small>The address of the computer running the Water O Water server.</small>
                </>
              )}
            </div>
          )}

          {import.meta.env.DEV && !isSignup && (
            <div className="au-demo">
              Development demo accounts
              <div>
                {DEMO.map((d) => (
                  <button type="button" key={d.identifier} onClick={() => useDemo(d)}>{d.label}</button>
                ))}
              </div>
            </div>
          )}
        </form>
      </main>
    </div>
  );
}
