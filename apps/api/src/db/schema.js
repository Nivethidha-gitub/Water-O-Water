/*
 * Database schema + lightweight migrations. Safe to run on every start:
 * tables are created if missing and new columns are added to older databases.
 */
const db = require("./database");

function columnsOf(table) {
  return db.pragma(`table_info(${table})`).map((c) => c.name);
}

function addColumn(table, column, definition) {
  if (!columnsOf(table).includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

/*
 * SQLite cannot change a CHECK constraint in place. Databases created before
 * the RIDER role existed have CHECK (role IN ('CUSTOMER','SUPPLIER')), so the
 * users table is rebuilt (rows are copied unchanged) the first time we start.
 */
function allowRiderRole() {
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'").get();
  if (!row || !row.sql || row.sql.includes("'RIDER'")) return;

  const cols = columnsOf("users");
  const keep = [
    "id", "name", "email", "phone", "password_hash", "role", "customer_id", "supplier_id", "created_at",
  ].filter((c) => cols.includes(c));
  const list = keep.join(", ");

  db.exec("DROP INDEX IF EXISTS ux_users_email; DROP INDEX IF EXISTS ux_users_phone;");
  db.transaction(() => {
    db.exec(`
      CREATE TABLE users_new (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('CUSTOMER', 'SUPPLIER', 'RIDER')),
        customer_id TEXT,
        supplier_id TEXT,
        created_at TEXT NOT NULL
      );
      INSERT INTO users_new (${list}) SELECT ${list} FROM users;
      DROP TABLE users;
      ALTER TABLE users_new RENAME TO users;
    `);
  })();
}

function ensureSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      status TEXT,
      plan TEXT,
      reliability_score REAL
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      household_id TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      locale TEXT
    );

    CREATE TABLE IF NOT EXISTS addresses (
      id TEXT PRIMARY KEY,
      household_id TEXT NOT NULL,
      line TEXT NOT NULL,
      delivery_pref TEXT
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      supplier_id TEXT NOT NULL,
      sku TEXT NOT NULL,
      name_en TEXT NOT NULL,
      name_ta TEXT,
      unit_price_paise INTEGER NOT NULL,
      service_type TEXT
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      household_id TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      address_id TEXT,
      primary_supplier_id TEXT,
      fulfilling_supplier_id TEXT,
      product_id TEXT,
      qty INTEGER NOT NULL,
      unit_price_paise INTEGER NOT NULL,
      total_paise INTEGER NOT NULL,
      source TEXT,
      status TEXT NOT NULL,
      is_fallback INTEGER DEFAULT 0,
      customer_consented_fallback INTEGER DEFAULT 0,
      version INTEGER DEFAULT 1,
      rider_name TEXT,
      eta TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      qty INTEGER NOT NULL,
      unit_price_paise INTEGER NOT NULL,
      total_paise INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      actor_type TEXT,
      reason TEXT,
      at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS service_areas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id TEXT NOT NULL,
      name TEXT NOT NULL
    );

    -- One account type for everybody. role decides which app the user gets.
    -- customer_id / supplier_id link the login to the business record.
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('CUSTOMER', 'SUPPLIER', 'RIDER')),
      customer_id TEXT,
      supplier_id TEXT,
      created_at TEXT NOT NULL
    );

    -- Only a SHA-256 of the session token is stored, never the token itself.
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    -- One row per notification, addressed to exactly one recipient.
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      recipient_type TEXT NOT NULL,
      recipient_id TEXT NOT NULL,
      type TEXT NOT NULL,
      order_id TEXT,
      title TEXT NOT NULL,
      body TEXT,
      created_at TEXT NOT NULL,
      read_at TEXT
    );

    -- Latest GPS point for each active delivery. Kept separately from orders
    -- so frequent location updates never rewrite the order record itself.
    CREATE TABLE IF NOT EXISTS rider_locations (
      order_id TEXT PRIMARY KEY,
      rider_user_id TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      accuracy REAL,
      speed REAL,
      heading REAL,
      updated_at TEXT NOT NULL
    );
  `);

  allowRiderRole();

  // Columns added after the first version of the schema.
  addColumn("orders", "order_type", "TEXT DEFAULT 'one-time'");
  addColumn("orders", "frequency", "TEXT");
  addColumn("orders", "delivery_days", "TEXT");
  addColumn("orders", "fallback_fee_paise", "INTEGER DEFAULT 0");
  addColumn("orders", "payment_method", "TEXT DEFAULT 'COD'");
  addColumn("orders", "payment_status", "TEXT DEFAULT 'PAY_ON_DELIVERY'");
  addColumn("orders", "rider_accepted_at", "TEXT"); // when the assigned rider accepted the delivery
  addColumn("order_items", "name", "TEXT");
  // Riders: a rider is a user (role RIDER) who works for one supplier (supplier_id).
  addColumn("users", "vehicle_no", "TEXT");
  // Rider availability: 1 = online (can be assigned deliveries), 0 = offline.
  addColumn("users", "is_online", "INTEGER DEFAULT 1");
  // Rider approval by their supplier: pending | approved | rejected. Existing riders and
  // other roles stay "approved"; only newly registered riders start as "pending".
  addColumn("users", "approval_status", "TEXT DEFAULT 'approved'");
  addColumn("users", "approval_note", "TEXT");
  addColumn("users", "approval_at", "TEXT");
  addColumn("orders", "decline_reason", "TEXT");
  // Notifications are idempotent: one row per (recipient, event). The same order change processed
  // twice (a retry, a replay) can never produce a second notification. NULL keys are always allowed.
  addColumn("notifications", "dedupe_key", "TEXT");
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS ux_notifications_dedupe ON notifications (dedupe_key)");
  db.exec(`
    CREATE TABLE IF NOT EXISTS rider_documents (
      user_id TEXT PRIMARY KEY,
      id_type TEXT NOT NULL,
      id_last4 TEXT NOT NULL,
      photo TEXT NOT NULL,
      submitted_at TEXT NOT NULL
    );
  `);
  // The rider (users.id) an order is currently assigned to.
  addColumn("orders", "rider_user_id", "TEXT");
  addColumn("orders", "rider_assigned_at", "TEXT");

  // Stock: NULL means "not tracked" (always available). low_stock_threshold drives the "Low stock" alert.
  addColumn("products", "stock_qty", "INTEGER");
  addColumn("products", "low_stock_threshold", "INTEGER DEFAULT 5");
  // Saved addresses: several per household, one default, optional standing delivery instructions.
  addColumn("addresses", "label", "TEXT");
  addColumn("addresses", "is_default", "INTEGER DEFAULT 0");
  addColumn("addresses", "instructions", "TEXT");
  // An order keeps its own copy of the address and instructions, so editing or deleting a saved address never changes past orders.
  addColumn("orders", "delivery_line", "TEXT");
  addColumn("orders", "delivery_instructions", "TEXT");
  // Proof of delivery: the customer shows this code; the rider enters it to complete the delivery.
  addColumn("orders", "delivery_code", "TEXT");
  addColumn("orders", "rating", "INTEGER");
  addColumn("orders", "feedback", "TEXT");
  addColumn("orders", "rated_at", "TEXT");
  db.exec(`
    CREATE TABLE IF NOT EXISTS delivery_proofs (
      order_id TEXT PRIMARY KEY,
      method TEXT NOT NULL,            -- code | photo
      photo TEXT,                      -- base64 JPEG, compressed by the app
      note TEXT,
      rider_user_id TEXT,
      created_at TEXT NOT NULL
    );
  `);

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS ux_users_email ON users (email) WHERE email IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS ux_users_phone ON users (phone) WHERE phone IS NOT NULL;
    CREATE INDEX IF NOT EXISTS ix_sessions_user ON sessions (user_id);
    CREATE INDEX IF NOT EXISTS ix_orders_customer ON orders (customer_id);
    CREATE INDEX IF NOT EXISTS ix_orders_supplier ON orders (fulfilling_supplier_id);
    CREATE INDEX IF NOT EXISTS ix_orders_rider ON orders (rider_user_id);
    CREATE INDEX IF NOT EXISTS ix_users_supplier ON users (supplier_id);
    CREATE INDEX IF NOT EXISTS ix_items_order ON order_items (order_id);
    CREATE INDEX IF NOT EXISTS ix_products_supplier ON products (supplier_id);
    CREATE INDEX IF NOT EXISTS ix_notifications_recipient
      ON notifications (recipient_type, recipient_id, created_at);
    CREATE INDEX IF NOT EXISTS ix_rider_locations_rider ON rider_locations (rider_user_id);
  `);
}

module.exports = { ensureSchema };
