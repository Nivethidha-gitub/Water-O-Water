/*
 * Demo sign-in accounts, created on first start (never in production).
 * Passwords are hashed like any other account.
 */
const db = require("../db/database");
const { hashPassword } = require("../modules/identity/password");

const DEMO_PASSWORD = "Water@123";

const DEMO_USERS = [
  { name: "Ayesha R.", email: "customer@wow.test", role: "CUSTOMER", customerId: "cust-ayesha" },
  { name: "Priya S.", email: "priya@wow.test", role: "CUSTOMER", customerId: "cust-priya" },
  { name: "Murugan", email: "murugan@wow.test", role: "SUPPLIER", supplierId: "sup-murugan" },
  { name: "Balaji", email: "balaji@wow.test", role: "SUPPLIER", supplierId: "sup-balaji" },
  // Riders: each delivers for one supplier (supplierId) and has a phone + vehicle.
  { name: "Karthik", email: "rider@wow.test", phone: "+919876540011", vehicleNo: "TN 37 DJ 0222", role: "RIDER", supplierId: "sup-murugan" },
  { name: "Suresh", email: "suresh@wow.test", phone: "+919876540012", vehicleNo: "TN 38 AB 4410", role: "RIDER", supplierId: "sup-murugan" },
  { name: "Dinesh", email: "dinesh@wow.test", phone: "+919876540021", vehicleNo: "TN 66 CK 1207", role: "RIDER", supplierId: "sup-balaji" },
];

async function seedDemoUsers() {
  for (const u of DEMO_USERS) {
    const exists = db.prepare("SELECT 1 FROM users WHERE email = ?").get(u.email);
    if (exists) continue;
    const linked = u.customerId
      ? db.prepare("SELECT 1 FROM customers WHERE id = ?").get(u.customerId)
      : db.prepare("SELECT 1 FROM suppliers WHERE id = ?").get(u.supplierId);
    if (!linked) continue;
    db.prepare(
      `INSERT INTO users (id, name, email, phone, password_hash, role, customer_id, supplier_id, vehicle_no, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      "user-" + u.email.split("@")[0],
      u.name,
      u.email,
      u.phone || null,
      await hashPassword(DEMO_PASSWORD),
      u.role,
      u.customerId || null,
      u.supplierId || null,
      u.vehicleNo || null,
      new Date().toISOString()
    );
  }
  linkDemoRiders();
}

// Demo only: attach the seeded in-flight orders to demo riders so the rider app
// has deliveries on first run. Never touches finished orders, orders that
// already have a rider, or riders of a different supplier.
const DEMO_RIDER_LINKS = [
  ["ord-10432", "user-rider"],
  ["ord-10436", "user-rider"],
  ["ord-10434", "user-suresh"],
  ["ord-10433", "user-dinesh"],
  ["ord-10435", "user-dinesh"],
];

function linkDemoRiders() {
  for (const [orderId, riderId] of DEMO_RIDER_LINKS) {
    db.prepare(
      `UPDATE orders
          SET rider_user_id = ?, rider_name = (SELECT name FROM users WHERE id = ?),
              rider_assigned_at = ?
        WHERE id = ? AND rider_user_id IS NULL
          AND status IN ('accepted', 'preparing', 'ready_for_pickup', 'picked_up', 'out_for_delivery')
          AND fulfilling_supplier_id = (SELECT supplier_id FROM users WHERE id = ? AND role = 'RIDER')`
    ).run(riderId, riderId, new Date().toISOString(), orderId, riderId);
  }
}

module.exports = { seedDemoUsers, linkDemoRiders, DEMO_PASSWORD, DEMO_USERS };
