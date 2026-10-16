/*
 * Order service.
 *
 * SQLite is the source of truth. `store.orders` is an in-process cache of the
 * same rows (kept in sync on every write) that the ledger / delivery /
 * fallback modules read from.
 *
 * Ownership rules live here so every route gets them for free:
 *   - an order belongs to one customer (customerId, taken from the session)
 *   - an order is assigned to one supplier (supplierId = the supplier the
 *     customer picked; changes only when the fallback flow re-assigns it)
 *   - only those two parties can read it; only that supplier can act on it
 */
const { ERROR_CODES } = require("../../../../../packages/contracts/enums/error-codes");
const { ORDER_STATUS } = require("../../../../../packages/contracts/enums/order-status");
const { ORDER_SOURCE } = require("../../../../../packages/contracts/enums/order-source");
const { findTransition } = require("../../../../../packages/contracts/order-machine/can-transition");
const { newId } = require("../../store/ids");
const { ApiError } = require("../../http/errors");
const db = require("../../db/database");

const ORDER_COLUMNS = `
  id, code, household_id AS householdId, customer_id AS customerId,
  address_id AS addressId, primary_supplier_id AS primarySupplierId,
  fulfilling_supplier_id AS fulfillingSupplierId, product_id AS productId,
  qty, unit_price_paise AS unitPricePaise, total_paise AS totalPaise, source,
  status, is_fallback AS isFallback,
  customer_consented_fallback AS customerConsentedFallback, version,
  rider_name AS riderName, eta, created_at AS createdAt,
  order_type AS orderType, frequency, delivery_days AS deliveryDays,
  fallback_fee_paise AS fallbackFeePaise, payment_status AS paymentStatus,
  rider_user_id AS riderUserId, rider_assigned_at AS riderAssignedAt,
  rider_accepted_at AS riderAcceptedAt,
  payment_method AS paymentMethod, delivery_line AS deliveryLine,
  delivery_instructions AS deliveryInstructions, delivery_code AS deliveryCode,
  rating, feedback, rated_at AS ratedAt, decline_reason AS declineReason
`;

// Steps only the rider assigned to the order may perform (checked on the server by user id).
const RIDER_EVENTS = new Set(["pickup", "start", "deliver", "exception"]);
// While the order is in one of these states the supplier may still (re)assign a rider.
const ASSIGNABLE = new Set([ORDER_STATUS.accepted, ORDER_STATUS.preparing, ORDER_STATUS.readyForPickup]);
// Where a rider can still change the customer-facing delivery time.
const ETA_EDITABLE = new Set([
  ORDER_STATUS.accepted, ORDER_STATUS.preparing, ORDER_STATUS.readyForPickup,
  ORDER_STATUS.pickedUp, ORDER_STATUS.outForDelivery,
]);
// The delivery code is shown to the customer from acceptance until the order is delivered.
const CODE_VISIBLE = new Set([
  ORDER_STATUS.accepted, ORDER_STATUS.preparing, ORDER_STATUS.readyForPickup,
  ORDER_STATUS.pickedUp, ORDER_STATUS.outForDelivery,
]);

const MAX_QTY = 100;
const MAX_LINES = 20;

function fail(status, code, message, field) {
  const err = new ApiError(status, code, message);
  if (field) err.field = field;
  return err;
}

function hydrate(row, items) {
  return {
    ...row,
    isFallback: Boolean(row.isFallback),
    customerConsentedFallback: Boolean(row.customerConsentedFallback),
    orderType: row.orderType || "one-time",
    deliveryDays: row.deliveryDays ? JSON.parse(row.deliveryDays) : [],
    fallbackFeePaise: row.fallbackFeePaise || 0,
    items: items || [],
  };
}

function createOrderService(store) {
  const listeners = [];

  // ---- persistence ---------------------------------------------------------

  function loadItems(orderId) {
    return db
      .prepare(
        `SELECT oi.product_id AS productId,
                COALESCE(oi.name, p.name_en, oi.product_id) AS name,
                oi.qty, oi.unit_price_paise AS unitPricePaise, oi.total_paise AS totalPaise
           FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id
          WHERE oi.order_id = ? ORDER BY oi.id`
      )
      .all(orderId);
  }

  /** Reloads the in-memory cache from SQLite. */
  function reload() {
    const rows = db.prepare(`SELECT ${ORDER_COLUMNS} FROM orders ORDER BY created_at DESC, rowid DESC`).all();
    store.orders.length = 0;
    for (const row of rows) store.orders.push(hydrate(row, loadItems(row.id)));
    store.orderEvents.length = 0;
    store.orderEvents.push(
      ...db
        .prepare(
          `SELECT order_id AS orderId, from_status AS fromStatus, to_status AS toStatus,
                  actor_type AS actorType, reason, at FROM order_events ORDER BY id`
        )
        .all()
    );
  }

  const insertEvent = () =>
    db.prepare(
      `INSERT INTO order_events (order_id, from_status, to_status, actor_type, reason, at)
       VALUES (?, ?, ?, ?, ?, ?)`
    );

  function recordEvent(event) {
    insertEvent().run(event.orderId, event.fromStatus, event.toStatus, event.actorType, event.reason, event.at);
    store.orderEvents.push(event);
  }

  function save(order) {
    db.prepare(
      `UPDATE orders SET status = ?, version = ?, fulfilling_supplier_id = ?, is_fallback = ?,
              customer_consented_fallback = ?, rider_name = ?, eta = ?, fallback_fee_paise = ?,
              rider_user_id = ?, rider_assigned_at = ?, rider_accepted_at = ?
        WHERE id = ?`
    ).run(
      order.status,
      order.version,
      order.fulfillingSupplierId,
      order.isFallback ? 1 : 0,
      order.customerConsentedFallback ? 1 : 0,
      order.riderName || null,
      order.eta || null,
      order.fallbackFeePaise || 0,
      order.riderUserId || null,
      order.riderAssignedAt || null,
      order.riderAcceptedAt || null,
      order.id
    );
  }

  // ---- events ----------------------------------------------------------------

  function on(listener) {
    listeners.push(listener);
  }

  function emit(kind, order, meta = {}) {
    for (const listener of listeners) {
      try {
        listener(kind, order, meta);
      } catch (err) {
        console.error("order listener failed:", err.message);
      }
    }
  }

  // ---- lookups -----------------------------------------------------------------

  const getById = (id) => store.orders.find((order) => order.id === id);

  /** The supplier an order is currently assigned to. */
  const supplierOf = (order) => order.fulfillingSupplierId || order.primarySupplierId;

  function isParty(order, user) {
    if (!order || !user) return false;
    if (user.role === "SUPPLIER") return Boolean(user.supplierId) && supplierOf(order) === user.supplierId;
    if (user.role === "CUSTOMER") return Boolean(user.customerId) && order.customerId === user.customerId;
    // A rider only ever sees the orders their supplier assigned to them.
    if (user.role === "RIDER") return Boolean(order.riderUserId) && order.riderUserId === user.id;
    return false;
  }

  /** Returns the order only if `user` is its customer or its supplier, else null. */
  function getForUser(id, user) {
    const order = getById(id);
    return isParty(order, user) ? order : null;
  }

  function listFor(user) {
    return store.orders.filter((order) => isParty(order, user));
  }

  const list = () => store.orders.slice();

  // ---- presentation --------------------------------------------------------------

  /**
   * Converts an order to the shape sent to a client. The supplier view includes
   * the customer's delivery details; the customer view includes the supplier.
   */
  function present(order, viewerRole) {
    const customer = db
      .prepare("SELECT id, name, phone FROM customers WHERE id = ?")
      .get(order.customerId);
    const supplier = db
      .prepare("SELECT id, name, phone FROM suppliers WHERE id = ?")
      .get(supplierOf(order));

    const rider = order.riderUserId
      ? db
          .prepare("SELECT id, name, phone, vehicle_no AS vehicleNo FROM users WHERE id = ?")
          .get(order.riderUserId)
      : null;

    const riderLocation = order.riderUserId
      ? db
          .prepare(
            `SELECT latitude, longitude, accuracy, speed, heading, updated_at AS updatedAt
               FROM rider_locations WHERE order_id = ? AND rider_user_id = ?`
          )
          .get(order.id, order.riderUserId)
      : null;

    const view = {
      id: order.id,
      orderId: order.id,
      code: order.code,
      customerId: order.customerId,
      supplierId: supplierOf(order),
      primarySupplierId: order.primarySupplierId,
      status: order.status,
      version: order.version,
      createdAt: order.createdAt,
      eta: order.eta,
      source: order.source,
      orderType: order.orderType,
      paymentMethod: order.paymentMethod || "COD",
      paymentStatus: order.paymentStatus || (order.paymentMethod === "UPI" ? "PENDING_GATEWAY" : "PAY_ON_DELIVERY"),
      frequency: order.frequency || null,
      deliveryDays: order.deliveryDays,
      totalPaise: order.totalPaise,
      riderName: order.riderName || null,
      riderUserId: order.riderUserId || null,
      riderAssignedAt: order.riderAssignedAt || null,
      riderAcceptedAt: order.riderAcceptedAt || null,
      rider: rider
        ? { id: rider.id, name: rider.name, phone: rider.phone, vehicleNo: rider.vehicleNo || null }
        : null,
      riderLocation: riderLocation
        ? {
            latitude: Number(riderLocation.latitude),
            longitude: Number(riderLocation.longitude),
            accuracy: riderLocation.accuracy == null ? null : Number(riderLocation.accuracy),
            speed: riderLocation.speed == null ? null : Number(riderLocation.speed),
            heading: riderLocation.heading == null ? null : Number(riderLocation.heading),
            updatedAt: riderLocation.updatedAt,
          }
        : null,
      isFallback: order.isFallback,
      // status changes with timestamps, for the tracking timeline
      history: store.orderEvents
        .filter((e) => e.orderId === order.id)
        .map((e) => ({ status: e.toStatus, reason: e.reason || null, at: e.at })),
      items: order.items.map((i) => ({ ...i })),
      // kept for older UI code that read the first line directly
      productId: order.productId,
      qty: order.qty,
      supplier: supplier ? { id: supplier.id, name: supplier.name, phone: supplier.phone } : null,
    };

    const saved = db
      .prepare("SELECT line FROM addresses WHERE id = ?")
      .get(order.addressId);
    const address = order.deliveryLine ? { line: order.deliveryLine } : saved;
    view.deliveryInstructions = order.deliveryInstructions || null;
    view.declineReason = order.declineReason || null;
    view.rating = order.rating || null;
    view.feedback = order.feedback || null;
    if (viewerRole === "SUPPLIER" || viewerRole === "RIDER") {
      view.customer = customer
        ? { id: customer.id, name: customer.name, phone: customer.phone, address: address ? address.line : null }
        : null;
      // The delivery code is for the customer only; riders and suppliers never see it.
      view.proofRequired = Boolean(order.deliveryCode);
    } else {
      if (order.deliveryCode && CODE_VISIBLE.has(order.status)) {
        view.deliveryCode = order.deliveryCode;
      }
      // The customer can see their own delivery address, but keep it outside
      // the nested customer object so the existing privacy contract remains
      // unchanged for older clients/tests.
      view.customer = customer ? { id: customer.id, name: customer.name } : null;
      view.deliveryAddress = address ? address.line : null;
    }
    return view;
  }

  // ---- placing an order --------------------------------------------------------------

  function normalizeItems(input) {
    let raw = Array.isArray(input.items) ? input.items : [];
    if (raw.length === 0 && input.productId) {
      raw = [{ productId: input.productId, qty: input.qty == null ? 1 : input.qty }];
    }
    if (raw.length === 0) {
      throw fail(400, ERROR_CODES.VALIDATION, "Select at least one product", "items");
    }
    if (raw.length > MAX_LINES) {
      throw fail(400, ERROR_CODES.VALIDATION, "Too many products in one order", "items");
    }
    const merged = new Map();
    for (const line of raw) {
      const productId = String((line && line.productId) || "").trim();
      const qty = Number(line && line.qty);
      if (!productId) throw fail(400, ERROR_CODES.VALIDATION, "Each item needs a productId", "items");
      if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) {
        throw fail(400, ERROR_CODES.VALIDATION, `Quantity must be a whole number from 1 to ${MAX_QTY}`, "qty");
      }
      merged.set(productId, (merged.get(productId) || 0) + qty);
    }
    return [...merged.entries()].map(([productId, qty]) => ({ productId, qty }));
  }

  function normalizeSchedule(input) {
    const orderType = input.orderType === "recurring" ? "recurring" : "one-time";
    let frequency = null;
    let deliveryDays = [];
    if (orderType === "recurring") {
      frequency = String(input.frequency || "custom").slice(0, 30);
      const days = Array.isArray(input.deliveryDays) ? input.deliveryDays : [];
      deliveryDays = [...new Set(days.map(Number).filter((d) => Number.isInteger(d) && d >= 1 && d <= 7))].sort();
      if (deliveryDays.length === 0) {
        throw fail(400, ERROR_CODES.VALIDATION, "Choose at least one delivery day", "deliveryDays");
      }
    }
    return { orderType, frequency, deliveryDays };
  }

  /**
   * Creates an order. `input.customerId` must come from the authenticated
   * session (routes) or a trusted internal caller - never from a request body.
   */
  function place(input) {
    const customer = db
      .prepare("SELECT id, household_id AS householdId FROM customers WHERE id = ?")
      .get(input.customerId);
    if (!customer) throw fail(400, ERROR_CODES.VALIDATION, "Customer not found", "customerId");

    const supplierId = String(input.supplierId || input.primarySupplierId || "").trim();
    if (!supplierId) throw fail(400, ERROR_CODES.VALIDATION, "Choose a supplier", "supplierId");
    const supplier = db.prepare("SELECT id, status FROM suppliers WHERE id = ?").get(supplierId);
    if (!supplier || supplier.status !== "verified") {
      throw fail(400, "SUPPLIER_NOT_FOUND", "That supplier is not available", "supplierId");
    }

    const lines = normalizeItems(input);
    const schedule = normalizeSchedule(input);

    const orderItems = lines.map(({ productId, qty }) => {
      const product = db
        .prepare(
          "SELECT id, supplier_id AS supplierId, name_en AS name, unit_price_paise AS unitPricePaise, stock_qty AS stockQty FROM products WHERE id = ?"
        )
        .get(productId);
      if (!product) throw fail(400, "PRODUCT_NOT_FOUND", "Product not found: " + productId, "items");
      if (product.supplierId !== supplierId) {
        throw fail(400, "PRODUCT_SUPPLIER_MISMATCH", "That product is not sold by the selected supplier", "items");
      }
      if (product.stockQty != null && product.stockQty < qty) {
        throw fail(
          409,
          "OUT_OF_STOCK",
          product.stockQty === 0 ? product.name + " is out of stock" : "Only " + product.stockQty + " of " + product.name + " left",
          "items"
        );
      }
      const unitPricePaise = Number(product.unitPricePaise);
      return { productId: product.id, name: product.name, qty, unitPricePaise, totalPaise: unitPricePaise * qty };
    });

    // The address the customer chose (it must be theirs), else their default, else any saved address.
    let address = null;
    if (input.addressId) {
      address = db
        .prepare("SELECT id, line, instructions FROM addresses WHERE id = ? AND household_id = ?")
        .get(String(input.addressId), customer.householdId);
      if (!address) throw fail(400, ERROR_CODES.VALIDATION, "Choose one of your saved addresses", "addressId");
    } else {
      address = db
        .prepare("SELECT id, line, instructions FROM addresses WHERE household_id = ? ORDER BY is_default DESC, id LIMIT 1")
        .get(customer.householdId);
    }
    const instructions =
      input.deliveryInstructions != null
        ? String(input.deliveryInstructions).trim().slice(0, 200)
        : address && address.instructions
          ? String(address.instructions).slice(0, 200)
          : "";
    const deliveryCode = String(1000 + Math.floor(Math.random() * 9000));

    const count = db.prepare("SELECT COUNT(*) AS n FROM orders").get().n;
    const first = orderItems[0];
    const createdAt = new Date().toISOString();
    const order = {
      id: newId(),
      code: "AR-" + (10000 + count),
      householdId: customer.householdId,
      customerId: customer.id,
      addressId: address ? address.id : null,
      deliveryLine: address ? address.line : null,
      deliveryInstructions: instructions || null,
      deliveryCode,
      primarySupplierId: supplierId,
      fulfillingSupplierId: supplierId,
      productId: first.productId,
      qty: first.qty,
      unitPricePaise: first.unitPricePaise,
      totalPaise: orderItems.reduce((sum, i) => sum + i.totalPaise, 0),
      source: input.source || ORDER_SOURCE.web,
      status: ORDER_STATUS.placed,
      isFallback: false,
      customerConsentedFallback: false,
      version: 1,
      riderName: null,
      eta: input.eta || "today 4–7 pm",
      createdAt,
      orderType: schedule.orderType,
      frequency: schedule.frequency,
      deliveryDays: schedule.deliveryDays,
      paymentMethod: String(input.paymentMethod || "COD").toUpperCase() === "UPI" ? "UPI" : "COD",
      paymentStatus: input.paymentStatus || (String(input.paymentMethod || "COD").toUpperCase() === "UPI" ? "PENDING_GATEWAY" : "PAY_ON_DELIVERY"),
      fallbackFeePaise: 0,
      items: orderItems,
    };

    db.transaction(() => {
      db.prepare(
        `INSERT INTO orders
           (id, code, household_id, customer_id, address_id, primary_supplier_id, fulfilling_supplier_id,
            product_id, qty, unit_price_paise, total_paise, source, status, is_fallback,
            customer_consented_fallback, version, rider_name, eta, created_at,
            order_type, frequency, delivery_days, fallback_fee_paise, payment_method, payment_status,
            delivery_line, delivery_instructions, delivery_code)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 1, NULL, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`
      ).run(
        order.id, order.code, order.householdId, order.customerId, order.addressId,
        supplierId, supplierId, first.productId, first.qty, first.unitPricePaise,
        order.totalPaise, order.source, order.status, order.eta, createdAt,
        order.orderType, order.frequency, JSON.stringify(order.deliveryDays), order.paymentMethod, order.paymentStatus,
        order.deliveryLine, order.deliveryInstructions, order.deliveryCode
      );
      // Take the stock in the same transaction as the order. The guarded UPDATE fails if
      // another order took it first, which rolls the whole order back (no overselling).
      const takeStock = db.prepare(
        "UPDATE products SET stock_qty = stock_qty - ? WHERE id = ? AND stock_qty IS NOT NULL AND stock_qty >= ?"
      );
      for (const item of orderItems) {
        const tracked = db.prepare("SELECT stock_qty AS stockQty FROM products WHERE id = ?").get(item.productId);
        if (tracked && tracked.stockQty != null && takeStock.run(item.qty, item.productId, item.qty).changes === 0) {
          throw fail(409, "OUT_OF_STOCK", item.name + " just ran out of stock", "items");
        }
      }
      const insertItem = db.prepare(
        `INSERT INTO order_items (order_id, product_id, name, qty, unit_price_paise, total_paise)
         VALUES (?, ?, ?, ?, ?, ?)`
      );
      for (const item of orderItems) {
        insertItem.run(order.id, item.productId, item.name, item.qty, item.unitPricePaise, item.totalPaise);
      }
    })();

    store.orders.unshift(order);
    recordEvent({
      orderId: order.id,
      fromStatus: null,
      toStatus: order.status,
      actorType: input.actorType || "customer",
      reason: "place",
      at: createdAt,
    });

    emit("placed", order, { actorType: "customer" });
    const low = orderItems
      .map((i) => db.prepare("SELECT id, name_en AS name, stock_qty AS stockQty, low_stock_threshold AS threshold FROM products WHERE id = ?").get(i.productId))
      .filter((r) => r && r.stockQty != null && r.stockQty <= (r.threshold == null ? 5 : r.threshold));
    if (low.length) emit("lowStock", order, { products: low });
    return order;
  }

  // ---- state changes --------------------------------------------------------------------

  // Cancelled / unfulfilled orders return their cans to stock (only tracked products change).
  function restoreStock(order) {
    const give = db.prepare("UPDATE products SET stock_qty = stock_qty + ? WHERE id = ? AND stock_qty IS NOT NULL");
    for (const item of order.items || []) give.run(item.qty, item.productId);
  }

  /**
   * Moves an order one step along the state machine.
   *
   * `actor` ({ userId }) is required for the rider steps (pickup / start / deliver / exception):
   * the signed-in user must be the rider assigned to this order, whatever the route did before.
   * Every change is written with a guard on the current status, so two requests racing for the same
   * step (e.g. a double "deliver") can never both succeed.
   */
  function transition(orderId, event, actorType, expectedVersion, actor) {
    const order = getById(orderId);
    if (!order) throw fail(404, ERROR_CODES.NOT_FOUND, "Order not found");

    if (expectedVersion != null && Number(expectedVersion) !== order.version) {
      throw fail(409, ERROR_CODES.ORDER_VERSION_CONFLICT, "Order changed, refresh");
    }

    if (event === "accept" && order.status === ORDER_STATUS.fallbackOffered) {
      if (order.customerConsentedFallback) {
        throw fail(409, ERROR_CODES.FALLBACK_LOCKED, "Primary locked after customer said yes");
      }
      event = "primary_accept";
    }

    const row = findTransition(order.status, event);
    if (!row || (row.who && actorType && !row.who.includes(actorType))) {
      throw fail(409, ERROR_CODES.ORDER_NOT_ACCEPTABLE, "This step is not allowed now");
    }

    if (RIDER_EVENTS.has(event)) {
      if (!actor || !actor.userId || !order.riderUserId || order.riderUserId !== actor.userId) {
        throw fail(403, ERROR_CODES.UNAUTHORIZED, "Only the rider assigned to this order can do this");
      }
      if (event === "pickup" && !order.riderAcceptedAt) {
        throw fail(409, "RIDER_NOT_ACCEPTED", "Accept the delivery before picking it up");
      }
    }

    const fromStatus = order.status;
    const fromVersion = order.version;
    const at = new Date().toISOString();
    const next = { status: row.to, version: fromVersion + 1 };

    db.transaction(() => {
      // Guarded write: only succeeds if the order is still in the status we checked above.
      const changed = db
        .prepare("UPDATE orders SET status = ?, version = ? WHERE id = ? AND status = ? AND version = ?")
        .run(next.status, next.version, order.id, fromStatus, fromVersion).changes;
      if (changed !== 1) throw fail(409, ERROR_CODES.ORDER_VERSION_CONFLICT, "Order changed, refresh");
      recordEvent({ orderId: order.id, fromStatus, toStatus: next.status, actorType, reason: event, at });
    })();

    // Only after the database has accepted the change do we update memory and tell anyone.
    order.status = next.status;
    order.version = next.version;

    if (order.status === ORDER_STATUS.cancelled || order.status === ORDER_STATUS.failed) {
      restoreStock(order);
    }
    emit("transition", order, { actorType, event, fromStatus });
    return order;
  }

  /**
   * Supplier assigns one of their own riders to an accepted order. Re-assigning
   * is allowed until the rider has started the delivery.
   */
  function assignRider(orderId, riderUserId) {
    const order = getById(orderId);
    if (!order) throw fail(404, ERROR_CODES.NOT_FOUND, "Order not found");
    if (!ASSIGNABLE.has(order.status)) {
      throw fail(
        409,
        ERROR_CODES.ORDER_NOT_ACCEPTABLE,
        order.status === ORDER_STATUS.placed || order.status === ORDER_STATUS.fallbackOffered
          ? "Accept the order before assigning a rider"
          : "A rider cannot be changed once the order has been picked up"
      );
    }
    const rider = db
      .prepare("SELECT id, name, is_online AS isOnline, approval_status AS approval FROM users WHERE id = ? AND role = 'RIDER' AND supplier_id = ?")
      .get(String(riderUserId || ""), supplierOf(order));
    if (!rider) {
      throw fail(400, ERROR_CODES.VALIDATION, "Choose one of your delivery partners", "riderId");
    }
    if (rider.approval && rider.approval !== "approved") {
      throw fail(409, "RIDER_NOT_APPROVED", rider.name + " has not been approved yet. Review their ID first.", "riderId");
    }
    if (rider.isOnline === 0) {
      throw fail(409, "RIDER_OFFLINE", rider.name + " is offline. Choose a rider who is online.", "riderId");
    }
    // A different rider must accept the delivery again.
    const previousRiderUserId = order.riderUserId || null;
    if (order.riderUserId !== rider.id) order.riderAcceptedAt = null;
    order.riderUserId = rider.id;
    order.riderName = rider.name;
    order.riderAssignedAt = new Date().toISOString();
    order.version += 1;
    save(order);
    emit("updated", order, { actorType: "owner", riderAssigned: true, previousRiderUserId });
    return order;
  }

  /**
   * The assigned rider accepts the delivery. Needed before they can pick it up.
   * Only the rider the supplier assigned can do this, and only once.
   */
  function acceptDelivery(orderId, riderUserId) {
    const order = getById(orderId);
    if (!order) throw fail(404, ERROR_CODES.NOT_FOUND, "Order not found");
    if (!order.riderUserId || order.riderUserId !== riderUserId) {
      throw fail(403, ERROR_CODES.UNAUTHORIZED, "This delivery is not assigned to you");
    }
    if (!ASSIGNABLE.has(order.status)) {
      throw fail(409, ERROR_CODES.ORDER_NOT_ACCEPTABLE, "This delivery can no longer be accepted");
    }
    if (order.riderAcceptedAt) throw fail(409, "ALREADY_ACCEPTED", "You have already accepted this delivery");
    order.riderAcceptedAt = new Date().toISOString();
    order.version += 1;
    save(order);
    emit("updated", order, { actorType: "rider", riderAccepted: true });
    return order;
  }

  /**
   * Rider-controlled delivery ETA. The rider may set/adjust the customer-facing
   * delivery time while the order is assigned to them and before completion.
   */
  function setEta(orderId, eta, riderUserId) {
    const order = getById(orderId);
    if (!order) throw fail(404, ERROR_CODES.NOT_FOUND, "Order not found");
    if (order.riderUserId !== riderUserId) throw fail(403, ERROR_CODES.UNAUTHORIZED, "This delivery is not assigned to you");
    if (!ETA_EDITABLE.has(order.status)) {
      throw fail(409, ERROR_CODES.ORDER_NOT_ACCEPTABLE, "Delivery time can only be changed before completion");
    }
    const value = String(eta || "").trim().slice(0, 80);
    if (!value) throw fail(400, ERROR_CODES.VALIDATION, "Enter a delivery time", "eta");
    order.eta = value;
    order.version += 1;
    save(order);
    emit("updated", order, { actorType: "rider", etaChanged: true });
    return order;
  }

  /** Persists changes a module made directly on an order (fallback flow). */
  function update(order, meta = {}) {
    save(order);
    emit("updated", order, meta);
    return order;
  }

  return {
    reload, getById, getForUser, isParty, list, listFor, present, supplierOf, emit,
    place, transition, assignRider, acceptDelivery, setEta, update, on,
  };
}

module.exports = { createOrderService };
