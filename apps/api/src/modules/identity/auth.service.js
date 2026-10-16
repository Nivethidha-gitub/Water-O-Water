const crypto = require("crypto");
const db = require("../../db/database");
const config = require("../../config");
const { newId } = require("../../store/ids");
const { checkIdDocument, saveIdDocument } = require("./rider-id");
const { ApiError } = require("../../http/errors");
const { hashPassword, verifyPassword } = require("./password");
const v = require("./validation");

const ROLES = Object.freeze({ CUSTOMER: "CUSTOMER", SUPPLIER: "SUPPLIER", RIDER: "RIDER" });

const USER_COLUMNS = `
  id, name, email, phone, password_hash AS passwordHash, role,
  customer_id AS customerId, supplier_id AS supplierId, vehicle_no AS vehicleNo,
  created_at AS createdAt, approval_status AS approvalStatus, approval_note AS approvalNote
`;

function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function publicUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    customerId: row.customerId || null,
    supplierId: row.supplierId || null,
    vehicleNo: row.vehicleNo || null,
    // Riders start as "pending" until their supplier approves the ID they uploaded.
    approvalStatus: row.approvalStatus || "approved",
    approvalNote: row.approvalNote || null,
  };
}

function createAuthService(store, { onDirectoryChanged } = {}) {
  // Dummy hash so unknown users cost the same time as wrong passwords.
  const dummyHash = hashPassword("not-a-real-password-1");

  const attempts = new Map(); // key -> [timestamps]

  function tooManyAttempts(key) {
    const windowMs = config.loginWindowMin * 60 * 1000;
    const now = Date.now();
    const list = (attempts.get(key) || []).filter((t) => now - t < windowMs);
    attempts.set(key, list);
    return list.length >= config.loginMaxAttempts;
  }

  function recordFailure(key) {
    const list = attempts.get(key) || [];
    list.push(Date.now());
    attempts.set(key, list);
  }

  function findByIdentity({ email, phone }) {
    if (email) {
      return db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE email = ?`).get(email);
    }
    return db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE phone = ?`).get(phone);
  }

  function createSession(userId) {
    const token = crypto.randomBytes(32).toString("base64url");
    const now = new Date();
    const expires = new Date(now.getTime() + config.sessionTtlHours * 3600 * 1000);
    db.prepare(
      "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)"
    ).run(sha256(token), userId, now.toISOString(), expires.toISOString());
    return { token, expiresAt: expires.toISOString() };
  }

  /** Validates a bearer token. Returns { user } or null. */
  function authenticate(token) {
    if (!token) return null;
    const row = db
      .prepare(
        `SELECT s.expires_at AS expiresAt, u.id, u.name, u.email, u.phone, u.role,
                u.customer_id AS customerId, u.supplier_id AS supplierId,
                u.vehicle_no AS vehicleNo, u.approval_status AS approvalStatus,
                u.approval_note AS approvalNote
           FROM sessions s JOIN users u ON u.id = s.user_id
          WHERE s.token_hash = ?`
      )
      .get(sha256(token));
    if (!row) return null;
    if (new Date(row.expiresAt).getTime() <= Date.now()) {
      db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(sha256(token));
      return null;
    }
    return { user: publicUser(row) };
  }

  function logout(token) {
    db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(sha256(token));
  }

  function profile(user) {
    const result = { ...user };
    if (user.role === ROLES.RIDER) {
      // A rider works for exactly one supplier (users.supplier_id).
      const s = db
        .prepare("SELECT id, name, phone FROM suppliers WHERE id = ?")
        .get(user.supplierId);
      result.supplier = s || null;
    } else if (user.role === ROLES.SUPPLIER) {
      const s = db
        .prepare("SELECT id, name, status FROM suppliers WHERE id = ?")
        .get(user.supplierId);
      result.supplier = s || null;
    } else {
      const c = db
        .prepare(
          "SELECT id, household_id AS householdId, name, phone, locale FROM customers WHERE id = ?"
        )
        .get(user.customerId);
      const a = c
        ? db
            .prepare(
              "SELECT id, line, delivery_pref AS deliveryPref FROM addresses WHERE household_id = ? ORDER BY is_default DESC, id LIMIT 1"
            )
            .get(c.householdId)
        : null;
      result.customer = c || null;
      result.address = a || null;
    }
    return result;
  }

  async function register(input) {
    const role = String(input.role || "").toUpperCase();
    if (!ROLES[role]) {
      throw v.fail("Choose a role: Customer, Supplier or Rider", "role");
    }

    const name = v.checkName(input.name, "Name", "name");
    const email = v.normalizeEmail(input.email);
    const phone = v.normalizePhone(input.phone);
    if (!email && !phone) {
      throw v.fail("Enter an email address or phone number", "email");
    }
    const password = v.checkPassword(input.password);

    let businessName = null;
    if (role === ROLES.SUPPLIER) {
      businessName = v.checkName(input.businessName || input.name, "Business name", "businessName");
    }
    const addressLine = String(input.address || "").trim().slice(0, 200);

    // A rider delivers for one supplier and must be reachable by phone.
    let riderSupplierId = null;
    let vehicleNo = null;
    let idDoc = null;
    if (role === ROLES.RIDER) {
      if (!phone) throw v.fail("Enter your phone number", "phone");
      riderSupplierId = String(input.supplierId || "").trim();
      if (!riderSupplierId) throw v.fail("Choose the supplier you deliver for", "supplierId");
      const sup = db
        .prepare("SELECT id, status FROM suppliers WHERE id = ?")
        .get(riderSupplierId);
      if (!sup || sup.status !== "verified") {
        throw v.fail("That supplier is not available", "supplierId");
      }
      vehicleNo = v.checkVehicle(input.vehicleNo);
      // One government photo ID is required; the supplier approves it before the rider can work.
      try {
        idDoc = checkIdDocument(input);
      } catch (err) {
        throw v.fail(err.message, err.field);
      }
    }

    if (email && db.prepare("SELECT 1 FROM users WHERE email = ?").get(email)) {
      throw new ApiError(409, "DUPLICATE_ACCOUNT", "An account with this email already exists");
    }
    if (phone && db.prepare("SELECT 1 FROM users WHERE phone = ?").get(phone)) {
      throw new ApiError(409, "DUPLICATE_ACCOUNT", "An account with this phone number already exists");
    }

    const passwordHash = await hashPassword(password);
    const userId = newId();
    const nowIso = new Date().toISOString();
    let customerId = null;
    let supplierId = null;

    const create = db.transaction(() => {
      if (role === ROLES.CUSTOMER) {
        const suffix = newId().slice(0, 8);
        customerId = "cust-" + suffix;
        const householdId = "hh-" + suffix;
        db.prepare(
          "INSERT INTO customers (id, household_id, name, phone, locale) VALUES (?, ?, ?, ?, ?)"
        ).run(customerId, householdId, name, phone, "en");
        db.prepare(
          "INSERT INTO addresses (id, household_id, line, delivery_pref) VALUES (?, ?, ?, ?)"
        ).run("addr-" + suffix, householdId, addressLine || "Address not set", "door");
      } else if (role === ROLES.RIDER) {
        supplierId = riderSupplierId;
      } else {
        supplierId = "sup-" + newId().slice(0, 8);
        db.prepare(
          "INSERT INTO suppliers (id, name, phone, status, plan, reliability_score) VALUES (?, ?, ?, ?, ?, ?)"
        ).run(supplierId, businessName, phone, "verified", "network", 0);
        if (addressLine) {
          db.prepare("INSERT INTO service_areas (supplier_id, name) VALUES (?, ?)").run(
            supplierId,
            addressLine
          );
        }
      }
      db.prepare(
        `INSERT INTO users (id, name, email, phone, password_hash, role, customer_id, supplier_id, vehicle_no, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(userId, name, email, phone, passwordHash, role, customerId, supplierId, vehicleNo, nowIso);
      if (role === ROLES.RIDER) {
        db.prepare("UPDATE users SET approval_status = 'pending' WHERE id = ?").run(userId);
        saveIdDocument(db, userId, idDoc);
      }
    });
    create();

    if (onDirectoryChanged) onDirectoryChanged();

    const user = publicUser(findByIdentity({ email, phone }));
    const session = createSession(userId);
    return { user: profile(user), ...session };
  }

  async function login(input, clientKey) {
    const identity = v.parseIdentifier(input.identifier || input.email || input.phone);
    const password = String(input.password || "");
    if (!password) throw v.fail("Enter your password", "password");

    const limiterKey = (identity.email || identity.phone) + "|" + (clientKey || "");
    if (tooManyAttempts(limiterKey)) {
      throw new ApiError(429, "TOO_MANY_ATTEMPTS", "Too many failed attempts. Try again later.");
    }

    const row = findByIdentity(identity);
    const ok = row
      ? await verifyPassword(password, row.passwordHash)
      : (await verifyPassword(password, await dummyHash), false);

    if (!ok) {
      recordFailure(limiterKey);
      throw new ApiError(401, "UNAUTHORIZED", "Incorrect email/phone or password");
    }

    const requestedRole = input.role ? String(input.role).toUpperCase() : null;
    if (requestedRole && requestedRole !== row.role) {
      throw new ApiError(
        403,
        "ROLE_MISMATCH",
        "This account is registered as a " + row.role.toLowerCase() + ". Switch to the " +
          row.role.toLowerCase() + " tab to sign in."
      );
    }

    attempts.delete(limiterKey);
    const session = createSession(row.id);
    return { user: profile(publicUser(row)), ...session };
  }

  /** Verified suppliers, for the rider sign-up picker (no sign-in needed yet). */
  function publicSuppliers() {
    return db
      .prepare("SELECT id, name FROM suppliers WHERE status = 'verified' ORDER BY name")
      .all();
  }

  function purgeExpiredSessions() {
    db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(new Date().toISOString());
  }

  return {
    register, login, logout, authenticate, profile, publicSuppliers, purgeExpiredSessions, ROLES,
  };
}

module.exports = { createAuthService, ROLES };
