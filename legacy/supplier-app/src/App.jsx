
import React, { useEffect, useState } from "react";

import {
  getOrders,
  getProducts,
  acceptOrder,
  startDelivery,
  createProduct,
  deleteProduct,
  getServiceAreas,
  createServiceArea,
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
  "prod-20l-balaji": "20L Can - Balaji Water",
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

  return String(status || "").replaceAll("_", " ");
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

  const [processingOrderId, setProcessingOrderId] = useState(null);
  const [showAllOrders, setShowAllOrders] = useState(false);

  const [showProductModal, setShowProductModal] = useState(false);
  const [showAreaModal, setShowAreaModal] = useState(false);

  const [products, setProducts] = useState([]);

 const [serviceAreas, setServiceAreas] = useState([]);

  const [productForm, setProductForm] = useState({
    name: "",
    sku: "",
    price: "",
  });

  const [areaForm, setAreaForm] = useState("");

  async function loadOrders() {
    try {
      setLoading(true);
      setError("");

      const data = await getOrders();

      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load orders:", err);
      setError("Unable to load orders from the backend.");
    } finally {
      setLoading(false);
    }
  }
async function loadProducts() {
  try {
    const data = await getProducts();

    console.log("Products received from backend:", data);

    const productList = Array.isArray(data) ? data : [];

    setProducts(
      productList.map((product) => ({
        id: product.id,
        name: product.nameEn,
        sku: product.sku,
        price: Number(product.unitPricePaise || 0) / 100,
      }))
    );
  } catch (err) {
    console.error("Failed to load products:", err);
    setProducts([]);
  }
}
async function loadServiceAreas() {
  try {
    const data = await getServiceAreas();

    console.log(
      "Service areas received from backend:",
      data
    );

    setServiceAreas(
      Array.isArray(data)
        ? data.map((area) => area.name)
        : []
    );
  } catch (err) {
    console.error(
      "Failed to load service areas:",
      err
    );

    setServiceAreas([]);
  }
}

  useEffect(() => {
    loadOrders();
    loadProducts();
     loadServiceAreas();
  }, []);

  async function handleAccept(order) {
    try {
      setProcessingOrderId(order.id);

      await acceptOrder(order.id, order.version);

      await loadOrders();
    } catch (err) {
      alert(err.message);
    } finally {
      setProcessingOrderId(null);
    }
  }

  async function handleStartDelivery(order) {
    try {
      setProcessingOrderId(order.id);

      await startDelivery(order.id);

      await loadOrders();
    } catch (err) {
      alert(err.message);
    } finally {
      setProcessingOrderId(null);
    }
  }
async function handleDeleteProduct(product) {
  const confirmed = window.confirm(
    `Are you sure you want to delete "${product.name}"?`
  );

  if (!confirmed) {
    return;
  }

  try {
    await deleteProduct(product.id);

    setProducts((current) =>
      current.filter((item) => item.id !== product.id)
    );

    alert("Product deleted successfully.");
  } catch (err) {
    alert(err.message);
  }
}
  async function handleProductSubmit(event) {
    event.preventDefault();

    if (
      !productForm.name.trim() ||
      !productForm.sku.trim() ||
      !productForm.price
    ) {
      alert("Please fill all product fields.");
      return;
    }

    try {
      const newProduct = await createProduct({
        name: productForm.name.trim(),
        sku: productForm.sku.trim().toUpperCase(),
        price: Number(productForm.price),
      });

      setProducts((current) => [
        ...current,
        {
          id: newProduct.id,
          name: newProduct.nameEn,
          sku: newProduct.sku,
          price: Number(newProduct.unitPricePaise || 0) / 100,
        },
      ]);

      setProductForm({
        name: "",
        sku: "",
        price: "",
      });

      setShowProductModal(false);

      alert("Product added successfully.");
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleAreaSubmit(event) {
  event.preventDefault();

  if (!areaForm.trim()) {
    alert("Please enter a service area.");
    return;
  }

  try {
    const newArea = await createServiceArea(
      areaForm.trim()
    );

    setServiceAreas((current) => [
      ...current,
      newArea.name,
    ]);

    setAreaForm("");

    setShowAreaModal(false);

    alert("Service area added successfully.");
  } catch (err) {
    alert(err.message);
  }
}
  const visibleOrders = showAllOrders
    ? orders
    : orders.slice(0, 8);

  return (
    <div className="app">

      {/* ================= HEADER ================= */}

      <header className="topbar">

        <div>
          <h1>AquaRoute</h1>
          <p>Supplier Dashboard</p>
        </div>

        <div className="supplier-toggle">

          <button className="active">
            Supplier
          </button>

          <button>
            Customer
          </button>

        </div>

        <div className="profile">

          <div className="profile-avatar">
            S
          </div>

          <div>
            <strong>Supplier</strong>
            <span>Coimbatore</span>
          </div>

        </div>

      </header>

      {/* ================= DASHBOARD ================= */}

      <main className="dashboard">

        {/* ================= STATS ================= */}

        <section className="stats-grid">

          <div className="stat-card">

            <span className="stat-label">
              Orders today
            </span>

            <strong className="stat-value">
              86
            </strong>

            <span className="positive">
              ↑ 12% vs yesterday
            </span>

          </div>

          <div className="stat-card">

            <span className="stat-label">
              Revenue today
            </span>

            <strong className="stat-value">
              ₹9,240
            </strong>

            <span className="positive">
              ↑ 8% vs yesterday
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

        {/* ================= MAIN CONTENT ================= */}

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
                onClick={() =>
                  setShowAllOrders(!showAllOrders)
                }
              >
                {showAllOrders
                  ? "Show less"
                  : "View all"}
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
                  <span>ETA</span>
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
                      {order.riderName ||
                        "Not assigned"}
                    </span>

                    <span className="eta-cell">
                      {order.eta ||
                        "Not available"}
                    </span>

                    <span className="status-cell">

                      {order.status === "placed" ? (

                        <button
                          className="accept-button"
                          disabled={
                            processingOrderId ===
                            order.id
                          }
                          onClick={() =>
                            handleAccept(order)
                          }
                        >
                          {processingOrderId ===
                          order.id
                            ? "Accepting..."
                            : "Accept Order"}
                        </button>

                      ) : order.status === "accepted" ? (

                        <button
                          className="start-button"
                          disabled={
                            processingOrderId ===
                            order.id
                          }
                          onClick={() =>
                            handleStartDelivery(order)
                          }
                        >
                          {processingOrderId ===
                          order.id
                            ? "Starting..."
                            : "Start Delivery"}
                        </button>

                      ) : (

                        <span
                          className={`badge ${getStatusClass(
                            order.status
                          )}`}
                        >
                          {formatStatus(
                            order.status
                          )}
                        </span>

                      )}

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

            {/* ================= QUICK ACTIONS ================= */}

            <div className="quick-actions">

              <button
                onClick={() =>
                  setShowProductModal(true)
                }
              >
                ＋ Add product
                <span>
                  (e.g. 1L cans)
                </span>
              </button>

              <button
                onClick={() =>
                  setShowAreaModal(true)
                }
              >
                ＋ Add service area
              </button>

            </div>

          </div>

          {/* ================= THIS WEEK ================= */}

          <div className="card week-card">

            <div className="card-header">

              <div>
                <h2>This week</h2>

                <p>
                  Order activity
                </p>
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

              <span>Plan usage</span>

              <p>
                86 orders/day × ₹3 platform fee
              </p>

              <strong>
                ≈ ₹258/day
              </strong>

              <small>
                owed to AquaRoute
              </small>

            </div>

          </div>

        </section>

        {/* ================= PRODUCT / AREA SUMMARY ================= */}

        <section className="resource-grid">

          <div className="card resource-card">

            <div className="card-header">

              <div>
                <h2>Products</h2>

                <p>
                  Products available from your store
                </p>
              </div>

              <button
                className="small-add-button"
                onClick={() =>
                  setShowProductModal(true)
                }
              >
                + Add
              </button>

            </div>

            <div className="resource-list">

              {products.map((product) => (

                <div
                  className="resource-item"
                  key={product.id}
                >

                  <div>

                    <strong>
                      {product.name}
                    </strong>

                    <span>
                      SKU: {product.sku}
                    </span>

                  </div>

                  <div className="product-actions">
  <strong>
    ₹{product.price}
  </strong>

  <button
    className="delete-button"
    onClick={() => handleDeleteProduct(product)}
  >
    Delete
  </button>
</div>

                </div>

              ))}

              {products.length === 0 && (
                <div className="message">
                  No products found.
                </div>
              )}

            </div>

          </div>

          <div className="card resource-card">

            <div className="card-header">

              <div>

                <h2>Service areas</h2>

                <p>
                  Areas currently supported
                </p>

              </div>

              <button
                className="small-add-button"
                onClick={() =>
                  setShowAreaModal(true)
                }
              >
                + Add
              </button>

            </div>

            <div className="area-list">

              {serviceAreas.map(
                (area, index) => (

                  <span
                    className="area-chip"
                    key={`${area}-${index}`}
                  >
                    {area}
                  </span>

                )
              )}

            </div>

          </div>

        </section>

      </main>

      {/* ================= ADD PRODUCT MODAL ================= */}

      {showProductModal && (

        <div
          className="modal-overlay"
          onClick={() =>
            setShowProductModal(false)
          }
        >

          <div
            className="modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            <div className="modal-header">

              <div>

                <h2>Add product</h2>

                <p>
                  Add a product to your supplier catalog.
                </p>

              </div>

              <button
                className="close-button"
                onClick={() =>
                  setShowProductModal(false)
                }
              >
                ×
              </button>

            </div>

            <form
              className="form"
              onSubmit={handleProductSubmit}
            >

              <label>

                Product name

                <input
                  type="text"
                  placeholder="Example: 1L Water Pack"
                  value={productForm.name}
                  onChange={(event) =>
                    setProductForm({
                      ...productForm,
                      name: event.target.value,
                    })
                  }
                />

              </label>

              <label>

                SKU

                <input
                  type="text"
                  placeholder="Example: PACK1"
                  value={productForm.sku}
                  onChange={(event) =>
                    setProductForm({
                      ...productForm,
                      sku: event.target.value,
                    })
                  }
                />

              </label>

              <label>

                Price

                <div className="price-input">

                  <span>₹</span>

                  <input
                    type="number"
                    min="1"
                    placeholder="40"
                    value={productForm.price}
                    onChange={(event) =>
                      setProductForm({
                        ...productForm,
                        price: event.target.value,
                      })
                    }
                  />

                </div>

              </label>

              <div className="modal-actions">

                <button
                  type="button"
                  className="cancel-button"
                  onClick={() =>
                    setShowProductModal(false)
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="save-button"
                >
                  Add product
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

      {/* ================= ADD SERVICE AREA MODAL ================= */}

      {showAreaModal && (

        <div
          className="modal-overlay"
          onClick={() =>
            setShowAreaModal(false)
          }
        >

          <div
            className="modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            <div className="modal-header">

              <div>

                <h2>Add service area</h2>

                <p>
                  Add a location where you provide delivery.
                </p>

              </div>

              <button
                className="close-button"
                onClick={() =>
                  setShowAreaModal(false)
                }
              >
                ×
              </button>

            </div>

            <form
              className="form"
              onSubmit={handleAreaSubmit}
            >

              <label>

                Service area

                <input
                  type="text"
                  placeholder="Example: RS Puram"
                  value={areaForm}
                  onChange={(event) =>
                    setAreaForm(event.target.value)
                  }
                />

              </label>

              <div className="modal-actions">

                <button
                  type="button"
                  className="cancel-button"
                  onClick={() =>
                    setShowAreaModal(false)
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="save-button"
                >
                  Add service area
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

    </div>
  );
}

export default App;

