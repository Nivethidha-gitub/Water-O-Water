import React, { useCallback, useEffect, useState } from "react";
import * as api from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { useEvents } from "../../realtime/useEvents";
import { Toasts, useToasts } from "../../components/Toasts";
import { notifyDesktop, setupNotifications } from "../../components/format";
import { ConfirmedScreen, HomeScreen, OrderScreen, OrdersScreen, ProfileScreen, TrackScreen } from "./screens";

const TABS = [
  { id: "home", label: "Home", icon: "⌂" },
  { id: "order", label: "Order", icon: "🛒" },
  { id: "track", label: "Track", icon: "📍" },
  { id: "orders", label: "Orders", icon: "🧾" },
  { id: "profile", label: "Profile", icon: "👤" },
];

function mergeOrder(list, order) {
  const exists = list.some((o) => o.id === order.id);
  const next = exists ? list.map((o) => (o.id === order.id ? order : o)) : [order, ...list];
  return next.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export default function CustomerApp() {
  const { user, signOut } = useAuth();
  const { toasts, push } = useToasts();

  const [screen, setScreen] = useState("home");
  const [data, setData] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [supplierId, setSupplierId] = useState(null);
  const [startRecurring, setStartRecurring] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState(null);
  const [trackId, setTrackId] = useState(null);
  const [unseenUpdate, setUnseenUpdate] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoadError("");
      const [boot, sups] = await Promise.all([api.getBootstrap(), api.getSuppliers()]);
      setData(boot);
      setSuppliers(sups);
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    setupNotifications();
  }, [load]);

  // Live status changes from the supplier (accepted, out for delivery, ...)
  useEvents({
    onEvent: (name, payload) => {
      if (name !== "order.updated" || !payload.order) return;
      setData((current) => (current ? { ...current, orders: mergeOrder(current.orders, payload.order) } : current));
      push(payload.notification?.title || "Order updated", "success");
      notifyDesktop(payload.notification?.title || "Order updated", payload.notification?.body || "");
      setUnseenUpdate(true);
    },
    onReconnect: load,
  });

  function go(next, orderId) {
    if (orderId) setTrackId(orderId);
    if (next === "track" || next === "orders") setUnseenUpdate(false);
    setScreen(next);
  }

  function startOrder(preselectedSupplierId, recurring = false) {
    setSupplierId(preselectedSupplierId || null);
    setStartRecurring(recurring);
    setScreen("order");
  }

  function handlePlaced(order) {
    setData((current) => ({ ...current, orders: mergeOrder(current.orders, order) }));
    setConfirmedOrder(order);
    setTrackId(order.id);
    setScreen("confirmed");
  }

  async function handleCancel(order) {
    try {
      const updated = await api.cancelOrder(order.id);
      setData((current) => ({ ...current, orders: mergeOrder(current.orders, updated) }));
      push(`Order ${order.code} cancelled`);
    } catch (err) {
      push(err.message, "error");
    }
  }

  let body = null;
  if (loading) {
    body = <div className="cx-screen center"><div className="spinner" /><p style={{ color: "#0e6e91", fontWeight: 600 }}>Loading WoW...</p></div>;
  } else if (loadError || !data) {
    body = (
      <div className="cx-screen center">
        <div className="cx-empty">
          <div className="ico">⚠️</div>
          <h3>Connection Error</h3>
          <p>{loadError || "Could not connect to the WoW backend."}</p>
          <button className="cx-btn" onClick={() => { setLoading(true); load(); }}>Try again</button>
        </div>
      </div>
    );
  } else {
    const content = {
      home: <HomeScreen data={data} suppliers={suppliers} go={go} startOrder={startOrder} />,
      order: (
        <OrderScreen
          key={supplierId || "pick"}
          suppliers={suppliers}
          supplierId={supplierId}
          setSupplierId={setSupplierId}
          startRecurring={startRecurring}
          onPlaced={handlePlaced}
          push={push}
        />
      ),
      confirmed: <ConfirmedScreen order={confirmedOrder} go={go} />,
      orders: <OrdersScreen orders={data.orders} go={go} startOrder={startOrder} onCancel={handleCancel} />,
      track: <TrackScreen orders={data.orders} selectedId={trackId} setSelectedId={setTrackId} go={go} startOrder={startOrder} />,
      profile: <ProfileScreen data={data} user={user} signOut={signOut} />,
    }[screen];
    body = <div className="cx-screen">{content}</div>;
  }

  return (
    <div className="cx-shell">
      <Toasts toasts={toasts} />
      <div className="cx-app">
        <div className="cx-header">
          <div>
            <h1>WoW</h1>
            <p>Water O Water</p>
          </div>
          <button className="cx-signout" onClick={signOut}>Sign out</button>
        </div>

        {body}

        {screen !== "confirmed" && data && (
          <nav className="cx-tabbar">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                className={screen === tab.id ? "on" : ""}
                onClick={() => (tab.id === "order" ? startOrder(null) : go(tab.id))}
              >
                {tab.id === "track" && unseenUpdate && <span className="badge-dot" />}
                <span className="ico">{tab.icon}</span>
                <span className="lbl">{tab.label}</span>
              </button>
            ))}
          </nav>
        )}
      </div>
    </div>
  );
}
