import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";

import { getServerUrl, getToken } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { notify, setupNotifications } from "../notifications/localNotify";
import { getNotifications } from "../api/notifications";
import { getItem, setItem } from "../utils/storage";

/*
 * Live updates over a WebSocket (ws://server/v1/ws).
 *
 * - Connects when a user is signed in, authenticates with the session token as
 *   the first message (never in the URL), and reconnects automatically with
 *   back-off if the connection drops or the phone changes network.
 * - Screens subscribe through usePolling(): when the server pushes an event
 *   they reload right away. Polling stays as a slow safety net, and becomes
 *   the main refresh method only while the socket is down.
 * - Notification events also pop a small in-app banner (app open) or a system notification (app in background).
 * - Every notification is announced once: by its id, so the live event and the catch-up below never double up.
 * - Catch-up: on every (re)connect and whenever the app returns to the foreground, the unread list is
 *   fetched and anything the phone has not announced yet (missed while the connection was down or the app
 *   was suspended) is announced then. The first ever sign-in only sets a baseline, so old history is not replayed.
 */
const Ctx = createContext({
  connected: false,
  subscribe: () => () => {},
  banner: null,
  dismissBanner: () => {},
  showBanner: () => {},
  unreadCount: 0,
  setUnreadCount: () => {},
  refreshUnread: () => {},
});

const MAX_CATCH_UP = 3; // announce at most this many missed notifications one by one
const lastSeenKey = (userId) => "wow.notif.lastSeen." + String(userId).replace(/[^A-Za-z0-9._-]/g, "_");

const PING_MS = 25000;
const PONG_TIMEOUT_MS = 10000;

export function RealtimeProvider({ children }) {
  const { user } = useAuth();
  const [connected, setConnected] = useState(false);
  const [banner, setBanner] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const listeners = useRef(new Set());
  const bannerTimer = useRef(null);

  const subscribe = useCallback((fn) => {
    listeners.current.add(fn);
    return () => listeners.current.delete(fn);
  }, []);

  const dismissBanner = useCallback(() => {
    clearTimeout(bannerTimer.current);
    setBanner(null);
  }, []);

  const showBanner = useCallback((title, body, data = {}) => {
    clearTimeout(bannerTimer.current);
    setBanner({ id: Date.now(), title, body, data });
    bannerTimer.current = setTimeout(() => setBanner(null), 5000);
  }, []);

  // The number on the bell: how many notifications this person has not read yet.
  const refreshUnread = useCallback(async () => {
    try { const d = await getNotifications(); setUnreadCount(d.unreadCount || 0); } catch (e) { /* keep the last count */ }
  }, []);
  const refreshUnreadRef = useRef(refreshUnread);
  refreshUnreadRef.current = refreshUnread;

  const announced = useRef(new Set()); // notification ids already shown to the person this session
  const catchingUp = useRef(false);

  const userId = user ? user.id : null;

  useEffect(() => {
    if (!userId) {
      setConnected(false);
      setUnreadCount(0);
      return undefined;
    }
    refreshUnreadRef.current();

    setupNotifications(); // ask for permission once, right after sign-in
    let stopped = false;
    let ws = null;
    let attempt = 0;
    let retryTimer = null;
    let pingTimer = null;
    let pongTimer = null;
    announced.current = new Set();

    /** Shows one notification (once): pop-up banner if the app is open, system notification if not. */
    const announce = (note) => {
      if (!note || !note.id || announced.current.has(note.id)) return false;
      announced.current.add(note.id);
      const data = { orderId: note.orderId || null, type: note.type };
      if (AppState.currentState === "active") showBanner(note.title, note.body, data);
      else notify(note.title, note.body, data).then((shown) => { if (!shown) showBanner(note.title, note.body, data); });
      if (note.createdAt) setItem(lastSeenKey(userId), note.createdAt).catch(() => {});
      return true;
    };

    /** Announces unread notifications that arrived while the live connection was down. */
    const catchUp = async () => {
      if (catchingUp.current || stopped) return;
      catchingUp.current = true;
      try {
        const d = await getNotifications();
        if (stopped) return;
        setUnreadCount(d.unreadCount || 0);
        const seen = await getItem(lastSeenKey(userId)).catch(() => null);
        const items = d.items || [];
        if (!seen) { // first time on this phone: baseline only, never replay old history
          const newest = items.reduce((m, n) => (n.createdAt > m ? n.createdAt : m), "");
          if (newest) await setItem(lastSeenKey(userId), newest).catch(() => {});
          items.forEach((n) => announced.current.add(n.id));
          return;
        }
        const missed = items
          .filter((n) => !n.readAt && n.createdAt > seen && !announced.current.has(n.id))
          .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
        if (!missed.length) return;
        missed.slice(0, -MAX_CATCH_UP).forEach((n) => announced.current.add(n.id)); // older ones: in the list only
        missed.slice(-MAX_CATCH_UP).forEach(announce);
        const newest = missed[missed.length - 1].createdAt;
        await setItem(lastSeenKey(userId), newest).catch(() => {});
      } catch (e) {
        /* offline: the next reconnect tries again */
      } finally {
        catchingUp.current = false;
      }
    };

    const stopPing = () => {
      clearInterval(pingTimer);
      clearTimeout(pongTimer);
    };

    const schedule = () => {
      if (stopped) return;
      clearTimeout(retryTimer);
      attempt += 1;
      const delay = Math.min(1000 * 2 ** Math.min(attempt, 4), 15000);
      retryTimer = setTimeout(connect, delay);
    };

    async function connect() {
      if (stopped) return;
      if (ws && ws.readyState <= 1) return; // already connecting / open
      const token = await getToken().catch(() => null);
      if (!token || stopped) return;

      let socket;
      try {
        socket = new WebSocket(getServerUrl().replace(/^http/i, "ws") + "/v1/ws");
      } catch (e) {
        schedule();
        return;
      }
      ws = socket;

      socket.onopen = () => socket.send(JSON.stringify({ type: "auth", token }));

      socket.onmessage = (message) => {
        let msg;
        try {
          msg = JSON.parse(message.data);
        } catch (e) {
          return;
        }
        if (msg.event === "ready") {
          attempt = 0;
          setConnected(true);
          stopPing();
          pingTimer = setInterval(() => {
            if (socket.readyState !== 1) return;
            socket.send(JSON.stringify({ type: "ping" }));
            pongTimer = setTimeout(() => socket.close(), PONG_TIMEOUT_MS); // dead link
          }, PING_MS);
          // Catch up on anything that happened while we were disconnected.
          listeners.current.forEach((fn) => fn({ event: "reconnected" }));
          catchUp();
          return;
        }
        if (msg.event === "pong") {
          clearTimeout(pongTimer);
          return;
        }
        if (msg.event === "unauthorized") {
          stopped = true; // the next API call gets a 401 and signs the user out
          return;
        }
        const note = msg.data && msg.data.notification;
        if (note && note.title) {
          announce({ ...note, orderId: note.orderId || (msg.data && msg.data.orderId) || null, type: note.type || msg.event });
          refreshUnreadRef.current(); // the bell number goes up
        }
        listeners.current.forEach((fn) => fn(msg));
      };

      socket.onclose = () => {
        stopPing();
        if (ws === socket) ws = null;
        setConnected(false);
        schedule();
      };
      socket.onerror = () => {}; // onclose always follows
    }

    connect();

    // Coming back to the app: reconnect immediately instead of waiting for back-off.
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      catchUp(); // the phone may have been asleep: pick up anything that was missed
      if (!ws || ws.readyState > 1) {
        clearTimeout(retryTimer);
        attempt = 0;
        connect();
      }
    });

    return () => {
      stopped = true;
      clearTimeout(retryTimer);
      stopPing();
      sub.remove();
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
      ws = null;
      setConnected(false);
    };
  }, [userId, showBanner, setUnreadCount]);

  const value = useMemo(
    () => ({ connected, subscribe, banner, dismissBanner, showBanner, unreadCount, setUnreadCount, refreshUnread }),
    [connected, subscribe, banner, dismissBanner, showBanner, unreadCount, refreshUnread]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useRealtime = () => useContext(Ctx);
