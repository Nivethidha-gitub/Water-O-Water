import React, { useEffect, useState } from "react";
import {
  getOrders,
  acceptOrder,
  startDelivery,
} from "./api";

const CUSTOMER_NAMES = {
  "cust-ayesha": "Ayesha R.",
  "cust-priya": "Priya S.",
  "cust-kavya": "Kavya M.",
  "cust-rahul": "Rahul K.",
  "cust-arun": "Arun P.",
};

const PRODUCT_NAMES = {
  can20: "20L Can",
  pack1: "1L Pack",
  "prod-20l": "20L Can",
  "prod-20l-balaji": "20L Can",
};

function getCustomerName(customerId) {
  return CUSTOMER_NAMES[customerId] || customerId;
}

function getProductName(productId) {
  return PRODUCT_NAMES[productId] || productId;
}

function formatStatus(status) {
  if (status === "out_for_delivery") {
    return "Out for delivery";
  }

  if (status === "accepted") {
    return "Accepted";
  }

  if (status === "placed") {
    return "New";
  }

  if (status === "delivered") {
    return "Delivered";
  }

  if (status === "fallback_offered") {
    return "Fallback";
  }

  return status.replaceAll("_", " ");
}

function getStatusClass(status) {
  if (status === "out_for_delivery") {
    return "orange";
  }

  if (status === "accepted") {
    return "blue";
  }

  if (status === "delivered") {
    return "green";
  }

  return "blue";
}

function App() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadOrders() {
    try {
      setLoading(true);
      setError("");

      const data = await getOrders();

      setOrders(data);
    } catch (err) {
      console.error(err);
      setError("Unable to load orders from the backend.");
    } finally {
      setLoading(false);
    }
  }

 useEffect(() => {
  console.log("Loading products...");
  loadOrders();
  loadProducts();
  loadServiceAreas();
}, []);

  async function handleAccept(order) {
    try {
      await acceptOrder(order.id, order.version);
      await loadOrders();
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleStartDelivery(order) {
    try {
      await startDelivery(order.id);
      await loadOrders();
    } catch (err) {
      alert(err.message);
    }
  }

  const visibleOrders = orders.slice(0, 8);

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>AquaRoute</h1>
          <p>Supplier Dashboard</p>
        </div>

        <div className="supplier-toggle">
          <button className="active">Supplier</button>
          <button>Customer</button>
        </div>

        <div className="profile">
          <div className="profile-avatar">S</div>

          <div>
            <strong>Supplier</strong>
            <span>Coimbatore</span>
          </div>
        </div>
      </header>

      <main className="dashboard">

        {/* ================= STATS ================= */}

        <section className="stats-grid">

          <div className="stat-card">
            <span className="stat-label">
              Orders today
            </span>

            <strong className="stat-value">
              {orders.length}
            </strong>

            <span className="positive">
              ↑ Live backend orders
            </span>
          </div>

          <div className="stat-card">
            <span className="stat-label">
              Revenue today
            </span>

            <strong className="stat-value">
              ₹
              {(
                orders.reduce(
                  (total, order) =>
                    total + Number(order.totalPaise || 0),
                  0
                ) / 100
              ).toLocaleString("en-IN")}
            </strong>

            <span className="positive">
              ↑ From current orders
            </span>
          </div>

          <div className="stat-card">
            <span className="stat-label">
              Active subscribers
            </span>

            <strong className="stat-value">
              312
            </strong>

            <span className="positive">
              ↑ 24 this month
            </span>
          </div>

          <div className="stat-card">
            <span className="stat-label">
              Riders online
            </span>

            <strong className="stat-value">
              7 / 9
            </strong>

            <span className="warning">
              2 offline
            </span>
          </div>

        </section>

        {/* ================= CONTENT ================= */}

        <section className="content-grid">

          {/* ================= LIVE ORDERS ================= */}

          <div className="card live-orders">

            <div className="card-header">

              <div>
                <h2>Live orders</h2>
                <p>
                  Real-time orders from your backend
                </p>
              </div>

              <button
                className="view-button"
                onClick={loadOrders}
              >
                Refresh ↻
              </button>

            </div>

            {loading && (
              <div className="message">
                Loading orders...
              </div>
            )}

            {error && (
              <div className="message error-message">
                {error}
              </div>
            )}

            {!loading && !error && (
              <div className="orders-table">

                <div className="table-row table-heading">
                  <span>ORDER</span>
                  <span>CUSTOMER</span>
                  <span>ITEM</span>
                  <span>RIDER</span>
                  <span>STATUS</span>
                </div>

                {visibleOrders.map((order) => (

                  <div
                    className="table-row"
                    key={order.id}
                  >

                    <span>
                      {order.code}
                    </span>

                    <span>
                      {getCustomerName(
                        order.customerId
                      )}
                    </span>

                    <span>
                      {order.qty} ×{" "}
                      {getProductName(
                        order.productId
                      )}
                    </span>

                    <span>
                      {order.riderName || "Not assigned"}
                    </span>

                    <span>
                      <span
                        className={`badge ${getStatusClass(
                          order.status
                        )}`}
                      >
                        {formatStatus(
                          order.status
                        )}
                      </span>
                    </span>

                  </div>

                ))}

              </div>
            )}

            {!loading &&
              !error &&
              orders.length === 0 && (
                <div className="message">
                  No orders found.
                </div>
              )}

            {/* ================= ACTIONS ================= */}

            <div className="order-actions">

              {orders
                .filter(
                  (order) =>
                    order.status === "placed"
                )
                .slice(0, 3)
                .map((order) => (

                  <div
                    className="order-action"
                    key={order.id}
                  >

                    <div>
                      <strong>
                        {order.code}
                      </strong>

                      <span>
                        {getCustomerName(
                          order.customerId
                        )}
                      </span>
                    </div>

                    <button
                      className="accept-button"
                      onClick={() =>
                        handleAccept(order)
                      }
                    >
                      Accept Order
                    </button>

                  </div>

                ))}

              {orders
                .filter(
                  (order) =>
                    order.status === "accepted"
                )
                .slice(0, 3)
                .map((order) => (

                  <div
                    className="order-action"
                    key={order.id}
                  >

                    <div>
                      <strong>
                        {order.code}
                      </strong>

                      <span>
                        {getCustomerName(
                          order.customerId
                        )}
                      </span>
                    </div>

                    <button
                      className="start-button"
                      onClick={() =>
                        handleStartDelivery(order)
                      }
                    >
                      Start Delivery
                    </button>

                  </div>

                ))}

            </div>

            {/* ================= QUICK ACTIONS ================= */}

            <div className="quick-actions">

              <button>
                ＋ Add product
                <span>
                  (e.g. 1L cans)
                </span>
              </button>

              <button>
                ＋ Add service area
              </button>

            </div>

          </div>

          {/* ================= WEEK ================= */}

          <div className="card week-card">

            <div className="card-header">

              <div>
                <h2>This week</h2>
                <p>Order activity</p>
              </div>

            </div>

            <div className="chart">

              <div className="bar-wrapper">
                <div
                  className="bar"
                  style={{ height: "48%" }}
                />
                <span>Mon</span>
              </div>

              <div className="bar-wrapper">
                <div
                  className="bar"
                  style={{ height: "62%" }}
                />
                <span>Tue</span>
              </div>

              <div className="bar-wrapper">
                <div
                  className="bar"
                  style={{ height: "55%" }}
                />
                <span>Wed</span>
              </div>

              <div className="bar-wrapper highlight">
                <div
                  className="bar"
                  style={{ height: "72%" }}
                />
                <span>Thu</span>
              </div>

              <div className="bar-wrapper highlight">
                <div
                  className="bar"
                  style={{ height: "82%" }}
                />
                <span>Fri</span>
              </div>

              <div className="bar-wrapper tallest">
                <div
                  className="bar"
                  style={{ height: "100%" }}
                />
                <span>Sat</span>
              </div>

              <div className="bar-wrapper">
                <div
                  className="bar"
                  style={{ height: "30%" }}
                />
                <span>Sun</span>
              </div>

            </div>

            <div className="usage">

              <span>
                Plan usage
              </span>

              <p>
                {orders.length} orders/day ×
                ₹3 platform fee
              </p>

              <strong>
                ≈ ₹
                {(orders.length * 3).toLocaleString(
                  "en-IN"
                )}
                /day
              </strong>

              <small>
                owed to AquaRoute
              </small>

            </div>

          </div>

        </section>

      </main>
    </div>
  );
}

export default App;