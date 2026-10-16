import React, { useEffect, useState } from "react";
import * as api from "../../api/client";
import { formatDate, itemsSummary, rupees } from "../../components/format";

const ACTIVE = (s) => !["delivered", "cancelled", "settled", "failed"].includes(s);
const STATUS_LABEL = {
  placed: "Placed",
  accepted: "Accepted",
  preparing: "Preparing",
  ready_for_pickup: "Ready for pickup",
  picked_up: "Picked up",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  fallback_offered: "Finding a supplier",
  exception: "Delayed",
  failed: "Unfulfilled",
  settled: "Delivered",
};
const pillClass = (s) => (s === "delivered" || s === "settled" ? "done" : s === "cancelled" || s === "failed" ? "off" : "");

function Empty({ title, text, onAction, action }) {
  return (
    <div className="cx-empty">
      <div className="ico">💧</div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action && <button className="cx-btn" onClick={onAction}>{action}</button>}
    </div>
  );
}

function SupplierCard({ supplier, selected, onSelect, cta }) {
  return (
    <button className={`cx-supplier ${selected ? "selected" : ""}`} onClick={() => onSelect(supplier)}>
      <span className="ico">🚚</span>
      <span className="body">
        <strong>{supplier.name}</strong>
        <small>
          {supplier.reliabilityScore ? `★ ${Number(supplier.reliabilityScore).toFixed(1)}% on-time · ` : ""}
          {supplier.productCount != null ? `${supplier.productCount} product${supplier.productCount === 1 ? "" : "s"}` : "Water supplier"}
        </small>
        {supplier.serviceAreas?.length > 0 && <small>Delivers to {supplier.serviceAreas.join(", ")}</small>}
      </span>
      <span className="go">{cta || "›"}</span>
    </button>
  );
}

function Stepper({ quantity, onMinus, onPlus }) {
  return (
    <div className="cx-stepper">
      <button aria-label="Decrease" onClick={onMinus}>−</button>
      <span>{quantity}</span>
      <button aria-label="Increase" onClick={onPlus}>+</button>
    </div>
  );
}

function ProductCard({ product, quantity, onMinus, onPlus }) {
  return (
    <div className="cx-product">
      <div className="info">
        <strong>{product.name}</strong>
        {product.description && <small>{product.description}</small>}
        <b>₹{product.price}</b>
      </div>
      <Stepper quantity={quantity} onMinus={onMinus} onPlus={onPlus} />
    </div>
  );
}

/* ---------------------------------------------------------------- Home */
export function HomeScreen({ data, suppliers, go, startOrder }) {
  const customer = data.customer || {};
  const orders = data.orders || [];
  const latest = orders.find((o) => ACTIVE(o.status));
  const last = orders[0];

  return (
    <>
      <div className="cx-greeting-row">
        <div>
          <h2>Hi, {customer.name || "there"} 👋</h2>
          <p>📍 {data.address?.line || "Add your delivery address"}</p>
        </div>
        <div className="cx-avatar">{(customer.name || "?").charAt(0).toUpperCase()}</div>
      </div>

      <div className="cx-hero">
        <small>YOUR WATER STATUS</small>
        <h3>{last ? "Running low? Reorder in a few taps" : "Order your first water can"}</h3>
        <p>{last ? `Your last order was from ${last.supplier?.name}. Reorder now so you're never dry.` : "Pick a supplier near you and place your first order."}</p>
        <button className="cx-btn" onClick={() => startOrder(last ? last.supplierId : null)}>
          {last ? "Reorder now" : "Choose a supplier"}
        </button>
      </div>

      <div className="cx-status">
        <div className="cx-status-head">
          <strong>{latest ? `Order ${STATUS_LABEL[latest.status] || latest.status}`.toLowerCase().replace(/^./, (c) => c.toUpperCase()) : "No active order"}</strong>
          {latest && <span className="cx-dot" />}
        </div>
        <p>{latest ? `${itemsSummary(latest)} · ${latest.supplier?.name} · ${latest.eta || ""}` : "Place an order to see delivery status"}</p>
        {latest && <button className="cx-link" onClick={() => go("track", latest.id)}>Track order →</button>}
      </div>

      <h3 className="cx-section">Suppliers near you</h3>
      {suppliers.length === 0 && <div className="cx-card">No suppliers available yet.</div>}
      {suppliers.slice(0, 4).map((s) => (
        <SupplierCard key={s.id} supplier={s} onSelect={(sup) => startOrder(sup.id)} cta="Order ›" />
      ))}

      <div className="cx-refill">
        <div>
          <h4>Never run out — Monthly Refill Plan</h4>
          <p>4 cans a month, auto-delivered · from ₹99/mo</p>
        </div>
        <button onClick={() => go("profile")}>View</button>
      </div>

      <div className="cx-promo">
        <h4>Never run out 💧</h4>
        <p>Set a daily, weekly or custom delivery schedule.</p>
        <button className="cx-link" onClick={() => startOrder(last ? last.supplierId : null, true)}>Create schedule →</button>
      </div>
    </>
  );
}

/* --------------------------------------------------------------- Order */
const DAYS = [
  { id: 1, name: "Mon" }, { id: 2, name: "Tue" }, { id: 3, name: "Wed" }, { id: 4, name: "Thu" },
  { id: 5, name: "Fri" }, { id: 6, name: "Sat" }, { id: 7, name: "Sun" },
];
const FREQUENCIES = [
  { id: "daily", label: "Daily", days: [1, 2, 3, 4, 5, 6, 7] },
  { id: "weekly", label: "Weekly", days: [2] },
  { id: "weekdays", label: "Weekdays", days: [1, 2, 3, 4, 5] },
  { id: "weekends", label: "Weekends", days: [6, 7] },
  { id: "2-days", label: "2 days/week", days: [2, 5] },
  { id: "3-days", label: "3 days/week", days: [2, 4, 6] },
  { id: "custom", label: "Custom", days: [] },
];

export function OrderScreen({ suppliers, supplierId, setSupplierId, startRecurring, onPlaced, push }) {
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [quantities, setQuantities] = useState({});
  const [orderType, setOrderType] = useState(startRecurring ? "recurring" : "one-time");
  const [frequency, setFrequency] = useState("weekly");
  const [selectedDays, setSelectedDays] = useState([2]);
  const [placing, setPlacing] = useState(false);

  const supplier = suppliers.find((s) => s.id === supplierId) || null;

  useEffect(() => {
    setQuantities({});
    if (!supplierId) {
      setProducts([]);
      return;
    }
    let cancelled = false;
    setLoadingProducts(true);
    api
      .getSupplierProducts(supplierId)
      .then((list) => {
        if (cancelled) return;
        setProducts(
          list.map((p) => ({ id: p.id, name: p.nameEn, description: p.nameTa && p.nameTa !== p.nameEn ? p.nameTa : "", price: Number(p.unitPricePaise || 0) / 100 }))
        );
      })
      .catch((err) => !cancelled && push(err.message, "error"))
      .finally(() => !cancelled && setLoadingProducts(false));
    return () => { cancelled = true; };
  }, [supplierId]); // eslint-disable-line react-hooks/exhaustive-deps

  const change = (id, delta) => setQuantities((q) => ({ ...q, [id]: Math.max(0, Math.min(100, (q[id] || 0) + delta)) }));
  const totalItems = products.reduce((n, p) => n + (quantities[p.id] || 0), 0);
  const totalPrice = products.reduce((n, p) => n + (quantities[p.id] || 0) * p.price, 0);

  function selectFrequency(f) {
    setFrequency(f.id);
    setSelectedDays(f.days);
  }
  function toggleDay(id) {
    setSelectedDays((days) => (days.includes(id) ? days.filter((d) => d !== id) : [...days, id].sort((a, b) => a - b)));
    setFrequency("custom");
  }

  const scheduleText =
    orderType === "one-time"
      ? "One-time delivery"
      : (FREQUENCIES.find((f) => f.id === frequency)?.label || "Custom") + ` · ${selectedDays.length} day${selectedDays.length === 1 ? "" : "s"}`;

  async function confirm() {
    if (totalItems === 0) return push("Please select at least one product.", "error");
    if (orderType === "recurring" && selectedDays.length === 0) return push("Please select at least one delivery day.", "error");
    if (placing) return;
    setPlacing(true);
    try {
      const order = await api.createOrder({
        supplierId,
        items: products.filter((p) => quantities[p.id] > 0).map((p) => ({ productId: p.id, qty: quantities[p.id] })),
        orderType,
        frequency: orderType === "recurring" ? frequency : null,
        deliveryDays: orderType === "recurring" ? selectedDays : [],
      });
      onPlaced(order);
    } catch (err) {
      push(err.message || "Could not place your order. Please try again.", "error");
    } finally {
      setPlacing(false);
    }
  }

  // Step 1: pick the supplier
  if (!supplier) {
    return (
      <>
        <h2 className="cx-title">Choose a supplier</h2>
        <p className="cx-subtitle">Your order goes to the supplier you pick.</p>
        {suppliers.length === 0 && <Empty title="No suppliers yet" text="Suppliers will appear here once they join." />}
        {suppliers.map((s) => (
          <SupplierCard key={s.id} supplier={s} onSelect={(sup) => setSupplierId(sup.id)} />
        ))}
      </>
    );
  }

  // Step 2: products, schedule and confirmation
  return (
    <>
      <h2 className="cx-title">Order Water</h2>
      <p className="cx-subtitle">Choose your water products</p>

      <div className="cx-chosen">
        <div>
          <span>ORDERING FROM</span>
          <strong>{supplier.name}</strong>
        </div>
        <button onClick={() => setSupplierId(null)}>Change</button>
      </div>

      {loadingProducts && <div className="cx-card">Loading products…</div>}
      {!loadingProducts && products.length === 0 && (
        <div className="cx-card">{supplier.name} has not added any products yet. Try another supplier.</div>
      )}
      {products.map((p) => (
        <ProductCard key={p.id} product={p} quantity={quantities[p.id] || 0} onMinus={() => change(p.id, -1)} onPlus={() => change(p.id, 1)} />
      ))}

      {products.length > 0 && (
        <>
          <h3 className="cx-section">Delivery type</h3>
          <div className="cx-seg">
            <button className={orderType === "one-time" ? "on" : ""} onClick={() => setOrderType("one-time")}>One-time</button>
            <button className={orderType === "recurring" ? "on" : ""} onClick={() => setOrderType("recurring")}>Recurring</button>
          </div>

          {orderType === "recurring" && (
            <>
              <h3 className="cx-section">Delivery frequency</h3>
              <div className="cx-chips">
                {FREQUENCIES.map((f) => (
                  <button key={f.id} className={frequency === f.id ? "on" : ""} onClick={() => selectFrequency(f)}>{f.label}</button>
                ))}
              </div>
              <h3 className="cx-section">Select delivery days</h3>
              <div className="cx-days">
                {DAYS.map((d) => (
                  <button key={d.id} className={selectedDays.includes(d.id) ? "on" : ""} onClick={() => toggleDay(d.id)}>{d.name}</button>
                ))}
              </div>
            </>
          )}

          <div className="cx-summary">
            <h4>Order summary</h4>
            <div className="cx-row"><span>Supplier</span><span>{supplier.name}</span></div>
            <div className="cx-row"><span>Items</span><span>{totalItems}</span></div>
            <div className="cx-row"><span>Delivery</span><span>{scheduleText}</span></div>
            <div className="cx-hr" />
            <div className="cx-row cx-total"><span>Total</span><span>₹{totalPrice}</span></div>
          </div>
          <button className="cx-btn" onClick={confirm} disabled={placing}>{placing ? "Placing order…" : "Confirm Order"}</button>
        </>
      )}
    </>
  );
}

/* ----------------------------------------------------------- Confirmed */
export function ConfirmedScreen({ order, go }) {
  if (!order) return null;
  return (
    <>
      <div className="cx-confirm-tick">✓</div>
      <h2 className="cx-title" style={{ textAlign: "center" }}>Order placed!</h2>
      <p className="cx-subtitle" style={{ textAlign: "center" }}>
        {order.supplier?.name} has been notified and will confirm shortly.
      </p>
      <div className="cx-summary" style={{ marginTop: 0 }}>
        <div className="cx-row"><span>Order ID</span><span>{order.code}</span></div>
        <div className="cx-row"><span>Supplier</span><span>{order.supplier?.name}</span></div>
        <div className="cx-row"><span>Items</span><span>{itemsSummary(order)}</span></div>
        <div className="cx-row"><span>Status</span><span>{STATUS_LABEL[order.status] || order.status}</span></div>
        <div className="cx-row"><span>Expected</span><span>{order.eta}</span></div>
        <div className="cx-hr" />
        <div className="cx-row cx-total"><span>Total</span><span>{rupees(order.totalPaise)}</span></div>
      </div>
      <button className="cx-btn" onClick={() => go("track", order.id)}>Track Order</button>
      <button className="cx-btn secondary" onClick={() => go("home")}>Back to Home</button>
    </>
  );
}

/* -------------------------------------------------------------- Orders */
export function OrdersScreen({ orders, go, startOrder, onCancel }) {
  const [cancelling, setCancelling] = useState(null);
  return (
    <>
      <h2 className="cx-title">Orders</h2>
      <p className="cx-subtitle">Your recent water orders</p>
      {orders.length === 0 ? (
        <Empty title="No orders yet" text="Place your first water order to see it here." action="Order Water" onAction={() => startOrder(null)} />
      ) : (
        orders.map((o) => (
          <div className="cx-order-card" key={o.id}>
            <div className="cx-order-head">
              <div>
                <strong>Order #{o.code}</strong>
                <small>{formatDate(o.createdAt)} · {o.supplier?.name}</small>
              </div>
              <span className={`cx-pill ${pillClass(o.status)}`}>{STATUS_LABEL[o.status] || o.status}</span>
            </div>
            <div className="cx-hr" />
            {o.items.map((item, i) => (
              <div className="cx-row" key={i}><span>{item.name}</span><span>× {item.qty}</span></div>
            ))}
            <div className="cx-row"><span>Total</span><span style={{ color: "#0e6e91" }}>{rupees(o.totalPaise)}</span></div>
            {ACTIVE(o.status) && o.eta && (
              <div className="cx-eta"><small>EXPECTED DELIVERY</small><strong>{o.eta}</strong></div>
            )}
            {ACTIVE(o.status) && <button className="cx-btn secondary" onClick={() => go("track", o.id)}>Track Order →</button>}
            {["placed", "accepted", "preparing"].includes(o.status) && (
              <button
                className="cx-btn danger"
                disabled={cancelling === o.id}
                onClick={async () => { setCancelling(o.id); await onCancel(o); setCancelling(null); }}
              >
                {cancelling === o.id ? "Cancelling…" : "Cancel order"}
              </button>
            )}
          </div>
        ))
      )}
      <button className="cx-btn" onClick={() => startOrder(null)}>+ Place New Order</button>
    </>
  );
}

/* --------------------------------------------------------------- Track */
const STEPS = [
  { key: "placed", title: "Order placed", text: "Your order has been received." },
  { key: "accepted", title: "Accepted", text: "The supplier accepted your order." },
  { key: "preparing", title: "Preparing", text: "Your cans are being filled and packed." },
  { key: "ready_for_pickup", title: "Ready for pickup", text: "Waiting for the delivery partner to collect it." },
  { key: "picked_up", title: "Picked up", text: "The rider has collected your order." },
  { key: "out_for_delivery", title: "Out for delivery", text: "Your delivery is on the way." },
  { key: "delivered", title: "Delivered", text: "Confirmed by the rider with your delivery code." },
];
// "Delivered" only lights up when the server says so (after the assigned rider completes the delivery).
const ORDER_OF = STEPS.map((s) => s.key);

export function TrackScreen({ orders, selectedId, setSelectedId, go, startOrder }) {
  const active = orders.filter((o) => ACTIVE(o.status));
  const order = orders.find((o) => o.id === selectedId) || active[0] || orders[0] || null;

  if (!order) {
    return <Empty title="No active order" text="Place an order to see its delivery status here." action="Order Water" onAction={() => startOrder(null)} />;
  }
  const current = order.status === "settled" ? ORDER_OF.length - 1 : ORDER_OF.indexOf(order.status === "exception" ? "out_for_delivery" : order.status);
  const cancelled = order.status === "cancelled";

  return (
    <>
      <h2 className="cx-title">Track Order</h2>
      <p className="cx-subtitle">Order #{order.code} · {order.supplier?.name}</p>

      {orders.length > 1 && (
        <div className="cx-pills">
          {orders.slice(0, 8).map((o) => (
            <button key={o.id} className={o.id === order.id ? "on" : ""} onClick={() => setSelectedId(o.id)}>{o.code}</button>
          ))}
        </div>
      )}

      <div className="cx-eta" style={{ marginTop: 0, marginBottom: 14, padding: 16 }}>
        <small>{cancelled ? "ORDER CANCELLED" : "EXPECTED DELIVERY"}</small>
        <strong style={{ fontSize: 20 }}>{cancelled ? "—" : order.eta}</strong>
        <span style={{ color: "#667980", fontSize: 13 }}>{STATUS_LABEL[order.status] || order.status}</span>
      </div>

      <div className="cx-order-card">
        <div className="cx-row" style={{ marginTop: 0 }}><span>Supplier</span><span>{order.supplier?.name}</span></div>
        {order.items.map((item, i) => (
          <div className="cx-row" key={i}><span>{item.name}</span><span>× {item.qty}</span></div>
        ))}
        <div className="cx-row"><span>Total</span><span>{rupees(order.totalPaise)}</span></div>
      </div>

      {!cancelled && (
        <>
          <h3 className="cx-section">Delivery status</h3>
          <div className="cx-timeline">
            {STEPS.map((step, i) => {
              const on = current >= i;
              const last = i === STEPS.length - 1;
              return (
                <div className="cx-tl-item" key={step.key}>
                  <div className="cx-tl-left">
                    <div className={`cx-tl-circle ${on ? "on" : ""}`}>{on ? "✓" : ""}</div>
                    {!last && <div className={`cx-tl-line ${current > i ? "on" : ""}`} />}
                  </div>
                  <div className={`cx-tl-body ${on ? "on" : ""}`}>
                    <strong>{step.title}</strong>
                    <small>{step.text}</small>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <button className="cx-btn secondary" onClick={() => go("orders")}>View All Orders</button>
      <button className="cx-btn secondary" onClick={() => go("home")}>Back to Home</button>
    </>
  );
}

/* ------------------------------------------------------------- Profile */
export function ProfileScreen({ data, user, signOut }) {
  const customer = data.customer || {};
  return (
    <>
      <h2 className="cx-title">Profile</h2>
      <p className="cx-subtitle">{customer.name}</p>

      <div className="cx-plan">
        <h4>Monthly Refill Plan</h4>
        <p>4 cans/month · from ₹99/mo</p>
        <button>Manage plan</button>
      </div>

      <div className="cx-profile-row"><span className="tile">🏠</span><div><strong>Home — {data.address?.line || "Not set"}</strong><small>Default delivery address</small></div></div>
      <div className="cx-profile-row"><span className="tile">✉️</span><div><strong>{user.email || "—"}</strong><small>Email</small></div></div>
      <div className="cx-profile-row"><span className="tile">📞</span><div><strong>{user.phone || "—"}</strong><small>Phone</small></div></div>
      <div className="cx-profile-row"><span className="tile">📦</span><div><strong>{(data.orders || []).length} orders</strong><small>All time</small></div></div>

      <button className="cx-btn danger" onClick={signOut}>Sign out</button>
    </>
  );
}
