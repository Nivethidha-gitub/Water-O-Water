const { parseBody } = require("../../http/parse-body");
const { sendJson, sendError } = require("../../http/send");

/*
 * Every route is guarded. The order service decides who may see an order
 * (its own customer and its assigned supplier); anyone else gets a 404, so
 * the existence of other people's orders is never revealed.
 */
function registerOrderRoutes(router, { db, orders, guard }) {
  const view = (order, user) => orders.present(order, user.role);

  function ownOrder(req, res) {
    const order = orders.getForUser(req.params.id, req.user);
    if (!order) sendError(res, 404, "NOT_FOUND", "Order not found");
    return order;
  }

  router.add(
    "GET",
    "/v1/orders",
    guard(["CUSTOMER", "SUPPLIER", "RIDER"], (req, res) => {
      const all = orders.listFor(req.user);
      const limit = Number(req.query.limit);
      // Without ?limit the full list is returned, as before.
      if (!Number.isInteger(limit) || limit < 1) {
        return sendJson(res, 200, { data: all.map((o) => view(o, req.user)) });
      }
      // Newest first. ?before=<createdAt>|<id> continues after the last order of the previous page.
      const sorted = all.slice().sort((a, b) => (a.createdAt === b.createdAt ? (a.id < b.id ? 1 : -1) : a.createdAt < b.createdAt ? 1 : -1));
      let start = 0;
      if (req.query.before) {
        const [at, id] = String(req.query.before).split("|");
        start = sorted.findIndex((o) => o.createdAt < at || (o.createdAt === at && o.id < id));
        if (start < 0) start = sorted.length;
      }
      const page = sorted.slice(start, start + Math.min(limit, 100));
      const last = page[page.length - 1];
      const hasMore = start + page.length < sorted.length;
      sendJson(res, 200, {
        data: page.map((o) => view(o, req.user)),
        meta: { total: sorted.length, hasMore, nextCursor: hasMore && last ? last.createdAt + "|" + last.id : null },
      });
    })
  );

  router.add(
    "GET",
    "/v1/orders/:id",
    guard(["CUSTOMER", "SUPPLIER", "RIDER"], (req, res) => {
      const order = ownOrder(req, res);
      if (order) sendJson(res, 200, { data: view(order, req.user) });
    })
  );

  // Customer places an order with the supplier they picked. The customer is
  // always the signed-in user - a customerId in the body is ignored.
  router.add(
    "POST",
    "/v1/orders",
    guard(["CUSTOMER"], async (req, res) => {
      const body = await parseBody(req);
      const order = orders.place({
        supplierId: body.supplierId,
        items: body.items,
        orderType: body.orderType,
        frequency: body.frequency,
        deliveryDays: body.deliveryDays,
        paymentMethod: body.paymentMethod,
        addressId: body.addressId,
        deliveryInstructions: body.deliveryInstructions,
        customerId: req.user.customerId,
        source: "web",
        actorType: "customer",
      });
      sendJson(res, 201, { data: view(order, req.user) });
    })
  );

  router.add(
    "POST",
    "/v1/orders/:id/cancel",
    guard(["CUSTOMER"], (req, res) => {
      const order = ownOrder(req, res);
      if (!order) return;
      sendJson(res, 200, { data: view(orders.transition(order.id, "cancel", "customer"), req.user) });
    })
  );

  router.add(
    "POST",
    "/v1/orders/:id/accept",
    guard(["SUPPLIER"], async (req, res) => {
      const order = ownOrder(req, res);
      if (!order) return;
      const body = await parseBody(req);
      const updated = orders.transition(order.id, "accept", "owner", body.expectedVersion);
      sendJson(res, 200, { data: view(updated, req.user) });
    })
  );

  router.add(
    "POST",
    "/v1/orders/:id/decline",
    guard(["SUPPLIER"], async (req, res) => {
      const order = ownOrder(req, res);
      if (!order) return;
      // The supplier can say why; the customer is told straight away (see order.notifier).
      const body = await parseBody(req);
      const reason = String(body.reason || "").trim().slice(0, 120);
      const updated = orders.transition(order.id, "decline", "owner");
      if (reason) {
        db.prepare("UPDATE orders SET decline_reason = ? WHERE id = ?").run(reason, order.id);
        updated.declineReason = reason;
      }
      orders.emit("declined", updated, { actorType: "owner", reason });
      sendJson(res, 200, { data: view(updated, req.user) });
    })
  );

  // Proof of delivery (code or photo) - visible to the customer, the order's supplier and its rider.
  router.add(
    "GET",
    "/v1/orders/:id/proof",
    guard(["CUSTOMER", "SUPPLIER", "RIDER"], (req, res) => {
      const order = ownOrder(req, res);
      if (!order) return;
      const row = db
        .prepare("SELECT method, photo, note, created_at AS createdAt FROM delivery_proofs WHERE order_id = ?")
        .get(order.id);
      if (!row) return sendError(res, 404, "NOT_FOUND", "No proof of delivery for this order");
      sendJson(res, 200, {
        data: { method: row.method, note: row.note, createdAt: row.createdAt, photo: row.photo ? "data:image/jpeg;base64," + row.photo : null },
      });
    })
  );

  // The customer rates a delivered order once: { rating: 1-5, feedback? }.
  router.add(
    "POST",
    "/v1/orders/:id/rating",
    guard(["CUSTOMER"], async (req, res) => {
      const order = ownOrder(req, res);
      if (!order) return;
      const body = await parseBody(req);
      const rating = Number(body.rating);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return sendError(res, 400, "VALIDATION", "Choose a rating from 1 to 5", "rating");
      }
      if (order.status !== "delivered" && order.status !== "settled") {
        return sendError(res, 409, "NOT_DELIVERED", "You can rate an order after it is delivered");
      }
      if (order.rating) return sendError(res, 409, "ALREADY_RATED", "You have already rated this order");
      const feedback = String(body.feedback || "").trim().slice(0, 300);
      db.prepare("UPDATE orders SET rating = ?, feedback = ?, rated_at = ? WHERE id = ?")
        .run(rating, feedback || null, new Date().toISOString(), order.id);
      order.rating = rating;
      order.feedback = feedback || null;
      sendJson(res, 200, { data: view(order, req.user) });
    })
  );

  // Bulk update: the supplier applies one action to many of their own orders.
  //   { action: "accept" | "prepare" | "ready" | "assign-rider", orderIds: [...], riderId? }
  // (Starting or completing a delivery is the rider's job and is not available here.)
  // Each order is processed on its own, so one that cannot change (already
  // moved on, no rider yet) never blocks the rest. The reply lists every result.
  router.add(
    "POST",
    "/v1/orders/bulk",
    guard(["SUPPLIER"], async (req, res) => {
      const body = await parseBody(req);
      const action = String(body.action || "");
      if (!["accept", "prepare", "ready", "assign-rider"].includes(action)) {
        return sendError(res, 400, "VALIDATION", "Choose a valid bulk action", "action");
      }
      const ids = Array.isArray(body.orderIds) ? [...new Set(body.orderIds.map(String))] : [];
      if (!ids.length) return sendError(res, 400, "VALIDATION", "Select at least one order", "orderIds");
      if (ids.length > 50) return sendError(res, 400, "VALIDATION", "You can update up to 50 orders at once", "orderIds");
      if (action === "assign-rider" && !body.riderId) {
        return sendError(res, 400, "VALIDATION", "Choose a delivery partner", "riderId");
      }

      const results = ids.map((id) => {
        const order = orders.getForUser(id, req.user);
        if (!order) return { orderId: id, ok: false, code: "NOT_FOUND", message: "Order not found" };
        try {
          let updated;
          if (action === "accept") updated = orders.transition(order.id, "accept", "owner");
          else if (action === "prepare") updated = orders.transition(order.id, "prepare", "owner");
          else if (action === "ready") updated = orders.transition(order.id, "ready", "owner");
          else updated = orders.assignRider(order.id, body.riderId);
          return { orderId: id, ok: true, order: view(updated, req.user) };
        } catch (err) {
          return { orderId: id, code: order.code, ok: false, status: err.status || 500, errorCode: err.code, message: err.message || "Could not update this order" };
        }
      });

      const succeeded = results.filter((r) => r.ok).length;
      sendJson(res, 200, { data: { action, succeeded, failed: results.length - succeeded, results } });
    })
  );

  // Supplier: accepted -> preparing -> ready for pickup.
  const supplierStep = (event) =>
    guard(["SUPPLIER"], async (req, res) => {
      const order = ownOrder(req, res);
      if (!order) return;
      const body = await parseBody(req);
      const updated = orders.transition(order.id, event, "owner", body.expectedVersion);
      sendJson(res, 200, { data: view(updated, req.user) });
    });
  router.add("POST", "/v1/orders/:id/prepare", supplierStep("prepare"));
  router.add("POST", "/v1/orders/:id/ready", supplierStep("ready"));

  // A supplier can no longer start a delivery: the assigned rider picks up and starts it.
  router.add(
    "POST",
    "/v1/orders/:id/start",
    guard(["SUPPLIER"], (req, res) => {
      sendError(res, 403, "SUPPLIER_CANNOT_DELIVER", "Only the assigned rider can start a delivery");
    })
  );
}

module.exports = { registerOrderRoutes };
