const { sendJson, sendError } = require("../../http/send");
const { parseBody } = require("../../http/parse-body");

const PRODUCT_SELECT = `
  SELECT id, supplier_id AS supplierId, sku, name_en AS nameEn, name_ta AS nameTa,
         unit_price_paise AS unitPricePaise, service_type AS serviceType,
         stock_qty AS stockQty, low_stock_threshold AS lowStockThreshold
    FROM products`;

// stockQty null = stock is not tracked for this product (always available).
function shapeProduct(row) {
  if (!row) return row;
  const tracked = row.stockQty != null;
  const threshold = row.lowStockThreshold == null ? 5 : row.lowStockThreshold;
  return {
    ...row,
    stockTracked: tracked,
    inStock: !tracked || row.stockQty > 0,
    lowStock: tracked && row.stockQty > 0 && row.stockQty <= threshold,
  };
}

// "" / null = not tracked; otherwise a whole number from 0 to 100000.
function parseStock(value) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 100000) {
    const err = new Error("Stock must be a whole number (leave blank to stop tracking)");
    err.status = 400; err.code = "VALIDATION"; err.field = "stock";
    throw err;
  }
  return n;
}

/*
 * Catalog: suppliers and products (browsed by customers, managed by their
 * supplier) plus the customer bootstrap payload. Supplier-owned data always
 * uses the supplier id from the session, never one sent by the client.
 */
function registerCatalogRoutes(router, { db, orders, store, guard }) {
  router.add("GET", "/v1/health", (req, res) => {
    sendJson(res, 200, { data: { ok: true } });
  });

  // Average customer rating for a supplier (orders the customer rated after delivery).
  function ratingOf(supplierId) {
    const r = db
      .prepare("SELECT AVG(rating) AS avg, COUNT(rating) AS n FROM orders WHERE fulfilling_supplier_id = ? AND rating IS NOT NULL")
      .get(supplierId);
    return { ratingAverage: r && r.n ? Math.round(r.avg * 10) / 10 : null, ratingCount: r ? r.n : 0 };
  }

  function listSuppliers() {
    const areas = db.prepare("SELECT supplier_id AS supplierId, name FROM service_areas ORDER BY name").all();
    const counts = db
      .prepare("SELECT supplier_id AS supplierId, COUNT(*) AS n FROM products GROUP BY supplier_id")
      .all();
    return db
      .prepare(
        `SELECT id, name, status, reliability_score AS reliabilityScore
           FROM suppliers WHERE status = 'verified' ORDER BY name`
      )
      .all()
      .map((s) => ({
        ...s,
        ...ratingOf(s.id),
        productCount: (counts.find((c) => c.supplierId === s.id) || { n: 0 }).n,
        serviceAreas: areas.filter((a) => a.supplierId === s.id).map((a) => a.name),
      }));
  }

  router.add(
    "GET",
    "/v1/suppliers",
    guard(["CUSTOMER", "SUPPLIER"], (req, res) => {
      sendJson(res, 200, { data: listSuppliers() });
    })
  );

  // Customers browse one supplier's catalog; a supplier only ever sees their own.
  router.add(
    "GET",
    "/v1/products",
    guard(["CUSTOMER", "SUPPLIER"], (req, res) => {
      if (req.user.role === "SUPPLIER") {
        const rows = db
          .prepare(PRODUCT_SELECT + " WHERE supplier_id = ? ORDER BY name_en")
          .all(req.user.supplierId);
        sendJson(res, 200, { data: rows.map(shapeProduct) });
        return;
      }
      const supplierId = String(req.query.supplierId || "");
      if (!supplierId) {
        sendError(res, 400, "VALIDATION", "supplierId is required", "supplierId");
        return;
      }
      const rows = db.prepare(PRODUCT_SELECT + " WHERE supplier_id = ? ORDER BY name_en").all(supplierId);
      sendJson(res, 200, { data: rows.map(shapeProduct) });
    })
  );

  router.add(
    "POST",
    "/v1/products",
    guard(["SUPPLIER"], async (req, res) => {
      const body = await parseBody(req);
      const name = String(body.name || "").trim().replace(/\s+/g, " ");
      const sku = String(body.sku || "").trim().toUpperCase();
      const price = Number(body.price);

      if (name.length < 2 || name.length > 80) {
        sendError(res, 400, "VALIDATION", "Product name must be 2-80 characters", "name");
        return;
      }
      if (!/^[A-Z0-9][A-Z0-9_-]{0,31}$/.test(sku)) {
        sendError(res, 400, "VALIDATION", "SKU can use letters, numbers, - and _ (max 32)", "sku");
        return;
      }
      if (!Number.isFinite(price) || price <= 0 || price > 100000) {
        sendError(res, 400, "VALIDATION", "Enter a valid price", "price");
        return;
      }

      let stock;
      try { stock = parseStock(body.stock); } catch (err) { return sendError(res, 400, "VALIDATION", err.message, "stock"); }

      const existing = db
        .prepare("SELECT id FROM products WHERE supplier_id = ? AND sku = ?")
        .get(req.user.supplierId, sku);
      if (existing) {
        sendError(res, 409, "DUPLICATE_SKU", "You already have a product with this SKU", "sku");
        return;
      }

      const id = "prod-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
      db.prepare(
        `INSERT INTO products (id, supplier_id, sku, name_en, name_ta, unit_price_paise, service_type, stock_qty)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(id, req.user.supplierId, sku, name, name, Math.round(price * 100), "exchange", stock === undefined ? null : stock);

      sendJson(res, 201, { data: shapeProduct(db.prepare(PRODUCT_SELECT + " WHERE id = ?").get(id)) });
    })
  );

  // Edit one of your products. Any of: { name, price, stock, stockDelta, lowStockThreshold }.
  //   stock: whole number to set, or null/"" to stop tracking.   stockDelta: +/- change (restock, damaged cans).
  router.add(
    "PATCH",
    "/v1/products/:id",
    guard(["SUPPLIER"], async (req, res) => {
      const body = await parseBody(req);
      const row = db.prepare("SELECT * FROM products WHERE id = ? AND supplier_id = ?").get(req.params.id, req.user.supplierId);
      if (!row) return sendError(res, 404, "NOT_FOUND", "Product not found");

      let name = row.name_en;
      if (body.name !== undefined) {
        name = String(body.name).trim().replace(/\s+/g, " ");
        if (name.length < 2 || name.length > 80) return sendError(res, 400, "VALIDATION", "Product name must be 2-80 characters", "name");
      }
      let price = row.unit_price_paise;
      if (body.price !== undefined) {
        const p = Number(body.price);
        if (!Number.isFinite(p) || p <= 0 || p > 100000) return sendError(res, 400, "VALIDATION", "Enter a valid price", "price");
        price = Math.round(p * 100);
      }
      let stock = row.stock_qty;
      try {
        const set = parseStock(body.stock);
        if (set !== undefined) stock = set;
      } catch (err) { return sendError(res, 400, "VALIDATION", err.message, "stock"); }
      if (body.stockDelta !== undefined) {
        const d = Number(body.stockDelta);
        if (!Number.isInteger(d) || Math.abs(d) > 100000) return sendError(res, 400, "VALIDATION", "Stock change must be a whole number", "stockDelta");
        if (stock == null) return sendError(res, 409, "STOCK_NOT_TRACKED", "Set a stock quantity first", "stockDelta");
        stock = Math.max(0, stock + d);
      }
      let threshold = row.low_stock_threshold == null ? 5 : row.low_stock_threshold;
      if (body.lowStockThreshold !== undefined) {
        const t = Number(body.lowStockThreshold);
        if (!Number.isInteger(t) || t < 0 || t > 100000) return sendError(res, 400, "VALIDATION", "Low-stock level must be a whole number", "lowStockThreshold");
        threshold = t;
      }
      db.prepare("UPDATE products SET name_en = ?, name_ta = ?, unit_price_paise = ?, stock_qty = ?, low_stock_threshold = ? WHERE id = ?")
        .run(name, name, price, stock, threshold, row.id);
      sendJson(res, 200, { data: shapeProduct(db.prepare(PRODUCT_SELECT + " WHERE id = ?").get(row.id)) });
    })
  );

  router.add(
    "DELETE",
    "/v1/products/:id",
    guard(["SUPPLIER"], (req, res) => {
      const result = db
        .prepare("DELETE FROM products WHERE id = ? AND supplier_id = ?")
        .run(req.params.id, req.user.supplierId);
      if (!result.changes) {
        sendError(res, 404, "NOT_FOUND", "Product not found");
        return;
      }
      sendJson(res, 200, { data: { id: req.params.id, deleted: true } });
    })
  );

  router.add(
    "GET",
    "/v1/service-areas",
    guard(["SUPPLIER"], (req, res) => {
      const areas = db
        .prepare("SELECT id, supplier_id AS supplierId, name FROM service_areas WHERE supplier_id = ? ORDER BY name")
        .all(req.user.supplierId);
      sendJson(res, 200, { data: areas });
    })
  );

  router.add(
    "POST",
    "/v1/service-areas",
    guard(["SUPPLIER"], async (req, res) => {
      const body = await parseBody(req);
      const name = String(body.name || "").trim().replace(/\s+/g, " ");
      if (name.length < 2 || name.length > 80) {
        sendError(res, 400, "VALIDATION", "Service area must be 2-80 characters", "name");
        return;
      }
      const existing = db
        .prepare("SELECT id FROM service_areas WHERE supplier_id = ? AND name = ?")
        .get(req.user.supplierId, name);
      if (existing) {
        sendError(res, 409, "DUPLICATE_AREA", "Service area already exists");
        return;
      }
      const result = db
        .prepare("INSERT INTO service_areas (supplier_id, name) VALUES (?, ?)")
        .run(req.user.supplierId, name);
      const area = db
        .prepare("SELECT id, supplier_id AS supplierId, name FROM service_areas WHERE id = ?")
        .get(Number(result.lastInsertRowid));
      sendJson(res, 201, { data: area });
    })
  );

  // Everything the customer app needs on start-up - for the signed-in customer only.
  router.add(
    "GET",
    "/v1/bootstrap",
    guard(["CUSTOMER"], (req, res) => {
      const customer = db
        .prepare("SELECT id, household_id AS householdId, name, phone, locale FROM customers WHERE id = ?")
        .get(req.user.customerId);
      if (!customer) {
        sendError(res, 404, "NOT_FOUND", "Customer profile not found");
        return;
      }
      const address = db
        .prepare("SELECT id, line, delivery_pref AS deliveryPref FROM addresses WHERE household_id = ? ORDER BY is_default DESC, id LIMIT 1")
        .get(customer.householdId);

      const mine = orders.listFor(req.user);
      const ids = new Set(mine.map((o) => o.id));
      sendJson(res, 200, {
        data: {
          customer,
          address: address || null,
          suppliers: listSuppliers(),
          orders: mine.map((o) => orders.present(o, "CUSTOMER")),
          events: store.orderEvents.filter((e) => ids.has(e.orderId)),
        },
      });
    })
  );
}

module.exports = { registerCatalogRoutes };
