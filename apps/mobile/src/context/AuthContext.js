import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { loginUser, registerUser, getCurrentUser, logoutUser } from "../api/auth";
import { clearToken, getToken, onUnauthorized, setToken, loadServerUrl } from "../api/client";

const AuthContext = createContext(null);

function unpackSession(result) {
  const data = result?.data ?? result;
  const token = data?.token ?? data?.accessToken ?? data?.access_token;
  const user = data?.user ?? data?.account ?? data?.profile;
  if (!token || !user) {
    throw new Error("The server response did not include a login token and user. Check the API response.");
  }
  return { token, user };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const signOutLocal = useCallback(async () => {
    try { await clearToken(); } catch (_) { /* clear local state even if storage fails */ }
    setUser(null);
  }, []);

  useEffect(() => {
    onUnauthorized(signOutLocal);
    let cancelled = false;
    (async () => {
      try {
        await loadServerUrl();
        const token = await getToken();
        if (token) {
          const response = await getCurrentUser();
          const data = response?.data ?? response;
          const restoredUser = data?.user ?? data?.account ?? data;
          if (!cancelled && restoredUser && restoredUser.role) setUser(restoredUser);
          else if (!cancelled) await signOutLocal();
        }
      } catch (_) {
        if (!cancelled) await signOutLocal();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      onUnauthorized(null);
    };
  }, [signOutLocal]);

  const startSession = useCallback(async (result) => {
    const session = unpackSession(result);
    await setToken(session.token);
    setUser(session.user);
    return session.user;
  }, []);

  const login = useCallback(async (identifier, password, role) => {
    const result = await loginUser(identifier, password, role);
    return startSession(result);
  }, [startSession]);

  const register = useCallback(async (userData) => {
    const result = await registerUser(userData);
    return startSession(result);
  }, [startSession]);

  // Re-reads the signed-in user (e.g. a rider waiting for approval) without signing in again.
  const refreshUser = useCallback(async () => {
    const fresh = await getCurrentUser();
    const data = fresh?.data ?? fresh;
    const next = data?.user ?? data?.account ?? data;
    if (next && next.role) setUser(next);
    return next;
  }, []);

  const logout = useCallback(async () => {
    try { await logoutUser(); } catch (_) { /* sign out locally if offline/session expired */ }
    await signOutLocal();
  }, [signOutLocal]);

  const value = useMemo(() => ({ user, loading, login, register, logout, refreshUser, signOut: logout }), [user, loading, login, register, logout, refreshUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
