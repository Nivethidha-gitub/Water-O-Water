import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as api from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(api.getToken()));

  const clearSession = useCallback(() => {
    api.setToken("");
    setUser(null);
  }, []);

  useEffect(() => {
    api.onUnauthorized(clearSession);
    return () => api.onUnauthorized(null);
  }, [clearSession]);

  // Restore an existing session on page load.
  useEffect(() => {
    if (!api.getToken()) return;
    let cancelled = false;
    api
      .getMe()
      .then((data) => !cancelled && setUser(data.user))
      .catch(() => !cancelled && clearSession())
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [clearSession]);

  const startSession = useCallback((result) => {
    api.setToken(result.token);
    setUser(result.user);
    return result.user;
  }, []);

  const signIn = useCallback(async (payload) => startSession(await api.login(payload)), [startSession]);
  const signUp = useCallback(async (payload) => startSession(await api.register(payload)), [startSession]);

  const signOut = useCallback(async () => {
    try {
      await api.logout(); // revokes the session on the server
    } catch {
      /* already expired or offline: still sign out locally */
    }
    clearSession();
  }, [clearSession]);

  const value = useMemo(
    () => ({ user, loading, signIn, signUp, signOut }),
    [user, loading, signIn, signUp, signOut]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export const homePathFor = (user) => (user?.role === "SUPPLIER" ? "/supplier" : "/customer");
