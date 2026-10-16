import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as api from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { useEvents } from "../../realtime/useEvents";
import { Toasts, useToasts } from "../../components/Toasts";
import { formatDateTime, formatStatus, itemsSummary, notifyDesktop, rupees, setupNotifications } from "../../components/format";

function getStatusClass(status) {
  if (status === "out_for_delivery") return "orange";
  if (status === "delivered" || status === "settled") return "green";
  return "blue";
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const isSameDay = (a, b) => a.toDateString() === b.toDateString();

function mergeOrder(list, order) {
  const exists = list.some((o) => o.id === order.id);
  const next = exists ? list.map((o) => (o.id === order.id ? order : o)) : [order, ...list];
  return next.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export default function SupplierApp() {
  const { user, signOut } = useAuth();
  const { toasts, push } = useToasts();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [processingOrderId, setProcessingOrderId] = useState(null);
  const [showAllOrders, setShowAllOrders] = useState(false);

  const [products, setProducts] = useState([]);
  const [serviceAreas, setServiceAreas] = useState([]);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showAreaModal, setShowAreaModal] = useState(false);
  const [productForm, setProductForm] = useState({ name: "", sku: "", price: "" });
  const [areaForm, setAreaForm] = useState("");

  const [notifications, setNotifications] = useState({ items: [], unreadCount: 0 });
  const [showNotifications, setShowNotifications] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [freshIds, setFreshIds] = useState(() => new Set());
  const bellRef = useRef(null);

  const supplierName = user.supplier?.name || user.name;

  // ---- data loading -------------------------------------------------------

  const loadOrders = useCallback(async () => {
    try {
      setError("");
      const data = await api.getOrders();
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Unable to load orders from the backend.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      setNotifications(await api.getNotifications());
    } catch {
      /* the bell simply stays empty */
    }
  }, []);

  useEffect(() => {
    loadOrders();
    loadNotifications();
    api.getProducts().then((data) =>
      setProducts(
        data.map((p) => ({ id: p.id, name: p.nameEn, sku: p.sku, price: Number(p.unitPricePaise || 0) / 100 }))
      )
    ).catch(() => setProducts([]));
    api.getServiceAreas().then((data) => setServiceAreas(data.map((a) => a.name))).catch(() => setServiceAreas([]));
    setupNotifications();
  }, [loadOrders, loadNotifications]);

  // ---- real-time ----------------------------------------------------------

  useEvents({
    onEvent: (name, payload) => {
      if (payload.order) setOrders((current) => mergeOrder(current, payload.order));
      if (payload.notification) {
        setNotifications((current) => ({
          items: [payload.notification, ...current.items.filter((n) => n.id !== payload.notification.id)].slice(0, 50),
          unreadCount: current.unreadCount + 1,
        }));
      }
      if (name === "order.created" && payload.order) {
        push(`New order ${payload.order.code} from ${payload.order.customer?.name || "a customer"}`, "success");
        notifyDesktop("New order " + payload.order.code, itemsSummary(payload.order));
        setFreshIds((current) => new Set(current).add(payload.order.id));
        setTimeout(
          () => setFreshIds((current) => { const next = new Set(current); next.delete(payload.order.id); return next; }),
          12000
        );
      } else if (name === "order.updated" && payload.notification) {
        push(payload.notification.title);
      }
    },
    onReconnect: () => {
      loadOrders();
      loadNotifications();
    },
  });

  // close the notification panel on outside click
  useEffect(() => {
    function onDown(event) {
      if (bellRef.current && !bellRef.current.contains(event.target)) setShowNotifications(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // ---- actions ------------------------------------------------------------

  async function runOrderAction(order, action) {
    try {
      setProcessingOrderId(order.id);
      const updated = action === "accept"
        ? await api.acceptOrder(order.id, order.version)
        : action === "prepare"
          ? await api.prepareOrder(order.id)
          : await api.markOrderReady(order.id);
      setOrders((current) => mergeOrder(current, updated));
    } catch (err) {
      push(err.message, "error");
      loadOrders();
    } finally {
      setProcessingOrderId(null);
    }
  }

  async function openNotification(notification) {
    setShowNotifications(false);
    if (notification.orderId) setSelectedOrderId(notification.orderId);
    if (!notification.readAt) {
      setNotifications((current) => ({
        items: current.items.map((n) => (n.id === notification.id ? { ...n, readAt: new Date().toISOString() } : n)),
        unreadCount: Math.max(0, current.unreadCount - 1),
      }));
      try { await api.markNotificationRead(notification.id); } catch { /* ignore */ }
    }
  }

  async function markAllRead() {
    setNotifications((current) => ({
      items: current.items.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })),
      unreadCount: 0,
    }));
    try { await api.markAllNotificationsRead(); } catch { /* ignore */ }
  }

  async function handleDeleteProduct(product) {
    if (!window.confirm(`Are you sure you want to delete "${product.name}"?`)) return;
    try {
      await api.deleteProduct(product.id);
      setProducts((current) => current.filter((item) => item.id !== product.id));
      push("Product deleted.", "success");
    } catch (err) {
      push(err.message, "error");
    }
  }

  async function handleProductSubmit(event) {
    event.preventDefault();
    if (!productForm.name.trim() || !productForm.sku.trim() || !productForm.price) {
      push("Please fill all product fields.", "error");
      return;
    }
    try {
      const p = await api.createProduct({
        name: productForm.name.trim(),
        sku: productForm.sku.trim().toUpperCase(),
        price: Number(productForm.price),
      });
      setProducts((current) => [...current, { id: p.id, name: p.nameEn, sku: p.sku, price: Number(p.unitPricePaise || 0) / 100 }]);
      setProductForm({ name: "", sku: "", price: "" });
      setShowProductModal(false);
      push("Product added.", "success");
    } catch (err) {
      push(err.message, "error");
    }
  }

  async function handleAreaSubmit(event) {
    event.preventDefault();
    if (!areaForm.trim()) {
      push("Please enter a service area.", "error");
      return;
    }
    try {
      const area = await api.createServiceArea(areaForm.trim());
      setServiceAreas((current) => [...current, area.name]);
      setAreaForm("");
      setShowAreaModal(false);
      push("Service area added.", "success");
    } catch (err) {
      push(err.message, "error");
    }
  }

  // ---- derived dashboard numbers (all real data) ----------------------------

  const stats = useMemo(() => {
    const today = new Date();
    const active = orders.filter((o) => o.status !== "cancelled");
    const todays = active.filter((o) => isSameDay(new Date(o.createdAt), today));
    const revenueToday = todays.reduce((sum, o) => sum + o.totalPaise, 0);
    const subscribers = new Set(active.filter((o) => o.orderType === "recurring").map((o) => o.customerId)).size;
    const awaiting = orders.filter((o) => o.status === "placed").length;

    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      days.push({
        label: DAY_NAMES[d.getDay()],
        count: active.filter((o) => isSameDay(new Date(o.createdAt), d)).length,
        today: i === 0,
      });
    }
    const max = Math.max(1, ...days.map((d) => d.count));
    return { ordersToday: todays.length, revenueToday, subscribers, awaiting, days, max };
  }, [orders]);

  const visibleOrders = showAllOrders ? orders : orders.slice(0, 8);
  const selectedOrder = orders.find((o) => o.id === selectedOrderId) || null;

  return (
    <div className="app">
      <Toasts toasts={toasts} />

      {/* ================= HEADER ================= */}
      <header className="topbar">
        <div>
          <h1>WoW</h1>
          <p>Supplier Dashboard</p>
        </div>

        <div className="topbar-right">
          <div className="bell-wrap" ref={bellRef}>
            <button
              className="bell-button"
              aria-label={`Notifications${notifications.unreadCount ? `, ${notifications.unreadCount} unread` : ""}`}
              onClick={() => setShowNotifications((v) => !v)}
            >
              🔔
              {notifications.unreadCount > 0 && <span className="bell-badge">{notifications.unreadCount > 9 ? "9+" : notifications.unreadCount}</span>}
            </button>

            {showNotifications && (
              <div className="notif-panel">
                <div className="notif-head">
                  <strong>Notifications</strong>
                  {notifications.unreadCount > 0 && <button onClick={markAllRead}>Mark all read</button>}
                </div>
                <div className="notif-list">
                  {notifications.items.length === 0 && <div className="notif-empty">No notifications yet.</div>}
                  {notifications.items.map((n) => (
                    <button key={n.id} className={`notif-item ${n.readAt ? "" : "unread"}`} onClick={() => openNotification(n)}>
                      <span className="notif-dot" />
                      <span className="notif-text">
                        <strong>{n.title}</strong>
                        <small>{n.body}</small>
                        <em>{formatDateTime(n.createdAt)}</em>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="profile">
            <div className="profile-avatar">{supplierName.charAt(0).toUpperCase()}</div>
            <div>
              <strong>{supplierName}</strong>
              <span>{user.email || user.phone}</span>
            </div>
          </div>
          <button className="logout-button" onClick={signOut}>Sign out</button>
        </div>
      </header>

      {/* ================= DASHBOARD ================= */}
      <main className="dashboard">
        <section className="stats-grid">
          <div className="stat-card">
            <span className="stat-label">Orders today</span>
            <strong className="stat-value">{stats.ordersToday}</strong>
            <span className="positive">{orders.length} total orders</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Revenue today</span>
            <strong className="stat-value">{rupees(stats.revenueToday)}</strong>
            <span className="positive">From today's orders</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Active subscribers</span>
            <strong className="stat-value">{stats.subscribers}</strong>
            <span className="positive">Recurring customers</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Awaiting acceptance</span>
            <strong className="stat-value">{stats.awaiting}</strong>
            <span className={stats.awaiting ? "warning" : "positive"}>
              {stats.awaiting ? "Needs your attention" : "All caught up"}
            </span>
          </div>
        </section>

        <section className="content-grid">
          {/* ================= LIVE ORDERS ================= */}
          <div className="card live-orders">
            <div className="card-header">
              <div>
                <h2>Live orders</h2>
                <p>Orders placed with {supplierName} appear here instantly</p>
              </div>
              <button className="view-button" onClick={() => setShowAllOrders(!showAllOrders)}>
                {showAllOrders ? "Show less" : "View all"}
              </button>
            </div>

            {loading && <div className="message">Loading orders...</div>}
            {error && <div className="message error-message">{error}</div>}

            {!loading && !error && (
              <div className="orders-table">
                <div className="table-row table-heading">
                  <span>ORDER</span>
                  <span>CUSTOMER</span>
                  <span>ITEMS</span>
                  <span>PLACED</span>
                  <span>ETA</span>
                  <span>STATUS</span>
                </div>

                {visibleOrders.map((order) => (
                  <div
                    className={`table-row clickable ${freshIds.has(order.id) ? "fresh" : ""}`}
                    key={order.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedOrderId(order.id)}
                    onKeyDown={(e) => e.key === "Enter" && setSelectedOrderId(order.id)}
                  >
                    <span>{order.code}</span>
                    <span>{order.customer?.name || order.customerId}</span>
                    <span>{itemsSummary(order)}</span>
                    <span className="eta-cell">{formatDateTime(order.createdAt)}</span>
                    <span className="eta-cell">{order.eta || "Not available"}</span>
                    <span className="status-cell" onClick={(e) => e.stopPropagation()}>
                      {order.status === "placed" ? (
                        <button className="accept-button" disabled={processingOrderId === order.id} onClick={() => runOrderAction(order, "accept")}>
                          {processingOrderId === order.id ? "Accepting..." : "Accept Order"}
                        </button>
                      ) : order.status === "accepted" ? (
                        <button className="start-button" disabled={processingOrderId === order.id} onClick={() => runOrderAction(order, "prepare")}>
                          {processingOrderId === order.id ? "Updating..." : "Start Preparing"}
                        </button>
                      ) : order.status === "preparing" ? (
                        <button className="start-button" disabled={processingOrderId === order.id} onClick={() => runOrderAction(order, "ready")}>
                          {processingOrderId === order.id ? "Updating..." : "Mark Ready for Pickup"}
                        </button>
                      ) : (
                        <span className={`badge ${getStatusClass(order.status)}`}>{formatStatus(order.status)}</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {!loading && !error && orders.length === 0 && (
              <div className="message">No orders yet. New orders will appear here the moment a customer places one.</div>
            )}

            <div className="quick-actions">
              <button onClick={() => setShowProductModal(true)}>＋ Add product<span>(e.g. 1L cans)</span></button>
              <button onClick={() => setShowAreaModal(true)}>＋ Add service area</button>
            </div>
          </div>

          {/* ================= THIS WEEK ================= */}
          <div className="card week-card">
            <div className="card-header">
              <div>
                <h2>This week</h2>
                <p>Order activity</p>
              </div>
            </div>

            <div className="chart">
              {stats.days.map((day, index) => (
                <div className={`bar-wrapper ${day.today ? "highlight" : ""}`} key={index} title={`${day.count} orders`}>
                  <div className="bar" style={{ height: `${Math.max(6, (day.count / stats.max) * 100)}%` }} />
                  <span>{day.label}</span>
                </div>
              ))}
            </div>

            <div className="usage">
              <span>Plan usage</span>
              <p>{stats.ordersToday} orders today × ₹3 platform fee</p>
              <strong>≈ ₹{stats.ordersToday * 3}/day</strong>
              <small>owed to WoW</small>
            </div>
          </div>
        </section>

        {/* ================= PRODUCT / AREA SUMMARY ================= */}
        <section className="resource-grid">
          <div className="card resource-card">
            <div className="card-header">
              <div>
                <h2>Products</h2>
                <p>Products customers can order from you</p>
              </div>
              <button className="small-add-button" onClick={() => setShowProductModal(true)}>+ Add</button>
            </div>

            <div className="resource-list">
              {products.map((product) => (
                <div className="resource-item" key={product.id}>
                  <div>
                    <strong>{product.name}</strong>
                    <span>SKU: {product.sku}</span>
                  </div>
                  <div className="product-actions">
                    <strong>₹{product.price}</strong>
                    <button className="delete-button" onClick={() => handleDeleteProduct(product)}>Delete</button>
                  </div>
                </div>
              ))}
              {products.length === 0 && <div className="message">No products yet. Add one so customers can order from you.</div>}
            </div>
          </div>

          <div className="card resource-card">
            <div className="card-header">
              <div>
                <h2>Service areas</h2>
                <p>Areas currently supported</p>
              </div>
              <button className="small-add-button" onClick={() => setShowAreaModal(true)}>+ Add</button>
            </div>
            <div className="area-list">
              {serviceAreas.map((area, index) => (
                <span className="area-chip" key={`${area}-${index}`}>{area}</span>
              ))}
              {serviceAreas.length === 0 && <div className="message">No service areas yet.</div>}
            </div>
          </div>
        </section>
      </main>

      {/* ================= ORDER DETAIL ================= */}
      {selectedOrderId && (
        <div className="modal-overlay" onClick={() => setSelectedOrderId(null)}>
          <div className="modal order-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>Order {selectedOrder?.code || ""}</h2>
                <p>{selectedOrder ? `Placed ${formatDateTime(selectedOrder.createdAt)}` : "Order not found"}</p>
              </div>
              <button className="close-button" onClick={() => setSelectedOrderId(null)}>×</button>
            </div>

            {selectedOrder ? (
              <div className="order-detail">
                <div className="od-row"><span>Status</span><span className={`badge ${getStatusClass(selectedOrder.status)}`}>{formatStatus(selectedOrder.status)}</span></div>
                <div className="od-row"><span>Order ID</span><strong className="mono">{selectedOrder.code} · {selectedOrder.id.slice(0, 8)}</strong></div>
                <div className="od-row"><span>Customer</span><strong>{selectedOrder.customer?.name || selectedOrder.customerId}</strong></div>
                <div className="od-row"><span>Delivery address</span><strong>{selectedOrder.customer?.address || "—"}</strong></div>
                <div className="od-row"><span>Delivery</span><strong>{selectedOrder.orderType === "recurring" ? `Recurring${selectedOrder.frequency ? ` · ${selectedOrder.frequency}` : ""}` : "One-time"} · {selectedOrder.eta || "—"}</strong></div>

                <div className="od-items">
                  <div className="od-items-head"><span>Product</span><span>Qty</span><span>Amount</span></div>
                  {selectedOrder.items.map((item, i) => (
                    <div className="od-items-row" key={i}>
                      <span>{item.name}</span><span>{item.qty}</span><span>{rupees(item.totalPaise)}</span>
                    </div>
                  ))}
                  <div className="od-items-row total"><span>Total</span><span /><span>{rupees(selectedOrder.totalPaise)}</span></div>
                </div>

                <div className="modal-actions">
                  <button className="cancel-button" onClick={() => setSelectedOrderId(null)}>Close</button>
                  {selectedOrder.status === "placed" && (
                    <button className="save-button" disabled={processingOrderId === selectedOrder.id} onClick={() => runOrderAction(selectedOrder, "accept")}>Accept order</button>
                  )}
                  {selectedOrder.status === "accepted" && (
                    <button className="save-button" disabled={processingOrderId === selectedOrder.id} onClick={() => runOrderAction(selectedOrder, "prepare")}>Start preparing</button>
                  )}
                  {selectedOrder.status === "preparing" && (
                    <button className="save-button" disabled={processingOrderId === selectedOrder.id} onClick={() => runOrderAction(selectedOrder, "ready")}>Mark ready for pickup</button>
                  )}
                </div>
              </div>
            ) : (
              <div className="message">This order is not available.</div>
            )}
          </div>
        </div>
      )}

      {/* ================= ADD PRODUCT MODAL ================= */}
      {showProductModal && (
        <div className="modal-overlay" onClick={() => setShowProductModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>Add product</h2>
                <p>Add a product to your supplier catalog.</p>
              </div>
              <button className="close-button" onClick={() => setShowProductModal(false)}>×</button>
            </div>
            <form className="form" onSubmit={handleProductSubmit}>
              <label>
                Product name
                <input type="text" placeholder="Example: 1L Water Pack" value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} />
              </label>
              <label>
                SKU
                <input type="text" placeholder="Example: PACK1" value={productForm.sku} onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })} />
              </label>
              <label>
                Price
                <div className="price-input">
                  <span>₹</span>
                  <input type="number" min="1" placeholder="40" value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: e.target.value })} />
                </div>
              </label>
              <div className="modal-actions">
                <button type="button" className="cancel-button" onClick={() => setShowProductModal(false)}>Cancel</button>
                <button type="submit" className="save-button">Add product</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= ADD SERVICE AREA MODAL ================= */}
      {showAreaModal && (
        <div className="modal-overlay" onClick={() => setShowAreaModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>Add service area</h2>
                <p>Add a location where you provide delivery.</p>
              </div>
              <button className="close-button" onClick={() => setShowAreaModal(false)}>×</button>
            </div>
            <form className="form" onSubmit={handleAreaSubmit}>
              <label>
                Service area
                <input type="text" placeholder="Example: RS Puram" value={areaForm} onChange={(e) => setAreaForm(e.target.value)} />
              </label>
              <div className="modal-actions">
                <button type="button" className="cancel-button" onClick={() => setShowAreaModal(false)}>Cancel</button>
                <button type="submit" className="save-button">Add service area</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
