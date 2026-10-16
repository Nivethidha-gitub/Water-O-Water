/*
 * The directory (suppliers, customers, addresses, households, products) lives
 * in SQLite. The in-memory store keeps a cached copy that the order flow reads
 * from. These helpers seed the demo data on first run and refresh the cache.
 */
const db = require("../db/database");

function seedDirectory(store) {
  db.transaction(() => {
    for (const s of store.suppliers) {
      db.prepare(
        `INSERT OR IGNORE INTO suppliers (id, name, phone, status, plan, reliability_score)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(s.id, s.name, s.phone, s.status, s.plan, s.reliabilityScore);
    }
    for (const c of store.customers) {
      db.prepare(
        `INSERT OR IGNORE INTO customers (id, household_id, name, phone, locale)
         VALUES (?, ?, ?, ?, ?)`
      ).run(c.id, c.householdId, c.name, c.phone, c.locale);
    }
    for (const a of store.addresses) {
      db.prepare(
        `INSERT OR IGNORE INTO addresses (id, household_id, line, delivery_pref)
         VALUES (?, ?, ?, ?)`
      ).run(a.id, a.householdId, a.line, a.deliveryPref);
    }
    for (const p of store.products) {
      db.prepare(
        `INSERT OR IGNORE INTO products
           (id, supplier_id, sku, name_en, name_ta, unit_price_paise, service_type)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(p.id, p.supplierId, p.sku, p.nameEn, p.nameTa, p.unitPricePaise, p.serviceType);
    }
  })();
}

function replaceContents(target, rows) {
  target.length = 0;
  target.push(...rows);
}

function loadDirectory(store) {
  replaceContents(
    store.suppliers,
    db
      .prepare(
        `SELECT id, name, phone, status, plan, reliability_score AS reliabilityScore
           FROM suppliers ORDER BY name`
      )
      .all()
  );
  const customers = db
    .prepare(`SELECT id, household_id AS householdId, name, phone, locale FROM customers ORDER BY name`)
    .all();
  replaceContents(store.customers, customers);
  replaceContents(
    store.addresses,
    db
      .prepare(
        `SELECT id, household_id AS householdId, line, delivery_pref AS deliveryPref
           FROM addresses ORDER BY id`
      )
      .all()
  );
  replaceContents(store.households, [...new Set(customers.map((c) => c.householdId))].map((id) => ({ id })));
  replaceContents(
    store.products,
    db
      .prepare(
        `SELECT id, supplier_id AS supplierId, sku, name_en AS nameEn, name_ta AS nameTa,
                unit_price_paise AS unitPricePaise, service_type AS serviceType FROM products`
      )
      .all()
  );
}

module.exports = { seedDirectory, loadDirectory };
