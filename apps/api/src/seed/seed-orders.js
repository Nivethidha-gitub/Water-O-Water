/*
 * Copies the demo orders (and their items / history) from the in-memory seed
 * into SQLite the first time the database is created. Existing rows are never
 * overwritten, so real data survives restarts.
 */
const db = require("../db/database");

function seedOrders(store) {
  const insertOrder = db.prepare(
    `INSERT OR IGNORE INTO orders
       (id, code, household_id, customer_id, address_id, primary_supplier_id, fulfilling_supplier_id,
        product_id, qty, unit_price_paise, total_paise, source, status, is_fallback,
        customer_consented_fallback, version, rider_name, eta, created_at,
        order_type, frequency, delivery_days, fallback_fee_paise)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'one-time', NULL, '[]', 0)`
  );
  const insertItem = db.prepare(
    `INSERT INTO order_items (order_id, product_id, name, qty, unit_price_paise, total_paise)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  const insertEvent = db.prepare(
    `INSERT INTO order_events (order_id, from_status, to_status, actor_type, reason, at)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  db.transaction(() => {
    for (const o of store.orders) {
      const result = insertOrder.run(
        o.id, o.code, o.householdId, o.customerId, o.addressId || null,
        o.primarySupplierId, o.fulfillingSupplierId || o.primarySupplierId,
        o.productId, o.qty, o.unitPricePaise, o.totalPaise, o.source || null, o.status,
        o.isFallback ? 1 : 0, o.customerConsentedFallback ? 1 : 0, o.version || 1,
        o.riderName || null, o.eta || null, o.createdAt
      );
      if (!result.changes) continue;

      const product = db.prepare("SELECT name_en AS name FROM products WHERE id = ?").get(o.productId);
      insertItem.run(o.id, o.productId, product ? product.name : o.productId, o.qty, o.unitPricePaise, o.totalPaise);
      for (const e of store.orderEvents.filter((ev) => ev.orderId === o.id)) {
        insertEvent.run(e.orderId, e.fromStatus || null, e.toStatus, e.actorType || null, e.reason || null, e.at);
      }
    }
  })();
}

module.exports = { seedOrders };
