/*
 * Riders.
 *
 * A rider is a user with role RIDER who works for one supplier. They never
 * browse the catalog or touch other orders: they only see the orders their
 * supplier assigned to them, and can only start / complete those.
 *
 *   Supplier:  GET  /v1/riders                      their delivery partners
 *              POST /v1/orders/:id/assign-rider     { riderId }
 *   Rider:     GET  /v1/rider/orders                assigned deliveries
 *              POST /v1/rider/orders/:id/accept     rider accepts the assignment
 *              POST /v1/rider/orders/:id/pickup     ready_for_pickup -> picked_up
 *              POST /v1/rider/orders/:id/start      picked_up -> out_for_delivery
 *              POST /v1/rider/orders/:id/deliver    out_for_delivery -> delivered (needs the customer's code or a photo)
 * Every rider step is checked on the server against the rider assigned to the order.
 */
const { parseBody } = require("../../http/parse-body");
const { sendJson, sendError } = require("../../http/send");
const { checkProof, saveProof } = require("../deliveries/proof");
const { ID_TYPES, checkIdDocument, saveIdDocument } = require("../identity/rider-id");

const ACTIVE = new Set(["accepted", "preparing", "ready_for_pickup", "picked_up", "out_for_delivery"]);
const DONE = new Set(["delivered", "settled"]);

function wholeNumber(value, field) {
  const n = Number(value == null || value === "" ? 0 : value);
  if (!Number.isInteger(n) || n < 0 || n > 1000) {
    const err = new Error(field + " must be a whole number");
    err.status = 400;
    err.code = "VALIDATION";
    err.field = field;
    throw err;
  }
  return n;
}

function registerRiderRoutes(router, { db, orders, deliveries, guard, hub, notifications }) {
  // Everything a rider does with deliveries needs the supplier's approval of their ID first.
  const approvedRider = (handler) =>
    guard(["RIDER"], (req, res) => {
      if (req.user.approvalStatus !== "approved") {
        return sendError(res, 403, "RIDER_NOT_APPROVED", "Your supplier has not approved your ID yet");
      }
      return handler(req, res);
    });

  // ---- supplier side -------------------------------------------------------

  router.add(
    "GET",
    "/v1/riders",
    guard(["SUPPLIER"], (req, res) => {
      const riders = db
        .prepare(
          `SELECT u.id AS id, u.name AS name, u.phone AS phone, u.vehicle_no AS vehicleNo, u.is_online AS online,
                  u.approval_status AS approvalStatus, u.approval_note AS approvalNote,
                  d.id_type AS idType, d.id_last4 AS idLast4, d.submitted_at AS submittedAt
             FROM users u LEFT JOIN rider_documents d ON d.user_id = u.id
            WHERE u.role = 'RIDER' AND u.supplier_id = ?
            ORDER BY CASE u.approval_status WHEN 'pending' THEN 0 ELSE 1 END, u.is_online DESC, u.name`
        )
        .all(req.user.supplierId);
      const mine = orders.list().filter((o) => orders.supplierOf(o) === req.user.supplierId);
      sendJson(res, 200, {
        data: riders.map((r) => ({
          ...r,
          online: r.online !== 0,
          approvalStatus: r.approvalStatus || "approved",
          idTypeLabel: r.idType ? ID_TYPES[r.idType] || r.idType : null,
          activeDeliveries: mine.filter((o) => o.riderUserId === r.id && ACTIVE.has(o.status)).length,
          completedDeliveries: mine.filter((o) => o.riderUserId === r.id && DONE.has(o.status)).length,
        })),
      });
    })
  );

  // ---- rider approval (supplier) ------------------------------------------

  const ownRider = (req, res) => {
    const rider = db
      .prepare("SELECT id, name, approval_status AS approvalStatus FROM users WHERE id = ? AND role = 'RIDER' AND supplier_id = ?")
      .get(req.params.id, req.user.supplierId);
    if (!rider) sendError(res, 404, "NOT_FOUND", "Delivery partner not found");
    return rider;
  };

  // The ID photo a rider uploaded: only their own supplier can open it.
  router.add(
    "GET",
    "/v1/riders/:id/document",
    guard(["SUPPLIER"], (req, res) => {
      const rider = ownRider(req, res);
      if (!rider) return;
      const doc = db.prepare("SELECT id_type AS idType, id_last4 AS idLast4, photo, submitted_at AS submittedAt FROM rider_documents WHERE user_id = ?").get(rider.id);
      if (!doc) return sendError(res, 404, "NOT_FOUND", "This rider has not uploaded an ID");
      sendJson(res, 200, {
        data: { idType: doc.idType, idTypeLabel: ID_TYPES[doc.idType] || doc.idType, idLast4: doc.idLast4, submittedAt: doc.submittedAt, photo: "data:image/jpeg;base64," + doc.photo },
      });
    })
  );

  const decide = (status) =>
    guard(["SUPPLIER"], async (req, res) => {
      const rider = ownRider(req, res);
      if (!rider) return;
      const body = await parseBody(req);
      const reason = String(body.reason || "").trim().slice(0, 200);
      if (status === "rejected" && reason.length < 3) {
        return sendError(res, 400, "VALIDATION", "Tell the rider why the ID was not accepted", "reason");
      }
      if (!db.prepare("SELECT 1 FROM rider_documents WHERE user_id = ?").get(rider.id)) {
        return sendError(res, 409, "NO_DOCUMENT", "This rider has not uploaded an ID yet");
      }
      db.prepare("UPDATE users SET approval_status = ?, approval_note = ?, approval_at = ? WHERE id = ?")
        .run(status, status === "rejected" ? reason : null, new Date().toISOString(), rider.id);
      notifications.notify({
        recipientType: "RIDER",
        recipientId: rider.id,
        type: "rider.approval",
        title: status === "approved" ? "You are approved" : "Your ID was not accepted",
        body: status === "approved" ? "You can now take deliveries from your supplier." : reason + " Upload your ID again to continue.",
        event: "rider.approval",
      });
      sendJson(res, 200, { data: { id: rider.id, approvalStatus: status } });
    });
  router.add("POST", "/v1/riders/:id/approve", decide("approved"));
  router.add("POST", "/v1/riders/:id/reject", decide("rejected"));

  // ---- rider verification (rider) -------------------------------------------
  // Open to a rider who is not approved yet; it is how they get approved.

  const verificationOf = (user) => {
    const row = db.prepare("SELECT approval_status AS status, approval_note AS note FROM users WHERE id = ?").get(user.id);
    const doc = db.prepare("SELECT id_type AS idType, id_last4 AS idLast4, submitted_at AS submittedAt FROM rider_documents WHERE user_id = ?").get(user.id);
    const supplier = db.prepare("SELECT name FROM suppliers WHERE id = ?").get(user.supplierId);
    return {
      status: row ? row.status || "approved" : "approved",
      note: row ? row.note : null,
      idTypeLabel: doc ? ID_TYPES[doc.idType] || doc.idType : null,
      idLast4: doc ? doc.idLast4 : null,
      submittedAt: doc ? doc.submittedAt : null,
      supplierName: supplier ? supplier.name : null,
    };
  };

  router.add("GET", "/v1/rider/verification", guard(["RIDER"], (req, res) => {
    sendJson(res, 200, { data: verificationOf(req.user) });
  }));

  // Upload (or replace) the ID: { idType, idNumber, idPhoto }. Sends the rider back to "pending".
  router.add("POST", "/v1/rider/verification", guard(["RIDER"], async (req, res) => {
    const current = verificationOf(req.user).status;
    if (current === "approved") return sendError(res, 409, "ALREADY_APPROVED", "You are already approved");
    const body = await parseBody(req, 2 * 1024 * 1024);
    let doc;
    try { doc = checkIdDocument(body); } catch (err) { return sendError(res, 400, "VALIDATION", err.message, err.field); }
    db.transaction(() => {
      saveIdDocument(db, req.user.id, doc);
      db.prepare("UPDATE users SET approval_status = 'pending', approval_note = NULL WHERE id = ?").run(req.user.id);
    })();
    notifications.notify({
      recipientType: "SUPPLIER",
      recipientId: req.user.supplierId,
      type: "rider.pending",
      title: "Delivery partner ID resubmitted",
      body: req.user.name + " uploaded an ID for your approval.",
      event: "rider.pending",
    });
    sendJson(res, 200, { data: verificationOf(req.user) });
  }));

  router.add(
    "POST",
    "/v1/orders/:id/assign-rider",
    guard(["SUPPLIER"], async (req, res) => {
      const order = orders.getForUser(req.params.id, req.user);
      if (!order) {
        sendError(res, 404, "NOT_FOUND", "Order not found");
        return;
      }
      const body = await parseBody(req);
      const updated = orders.assignRider(order.id, body.riderId);
      sendJson(res, 200, { data: orders.present(updated, "SUPPLIER") });
    })
  );

  // ---- rider side ----------------------------------------------------------

  router.add(
    "POST",
    "/v1/rider/location",
    approvedRider( async (req, res) => {
      const body = await parseBody(req);
      const latitude = Number(body.latitude);
      const longitude = Number(body.longitude);
      const accuracy = body.accuracy == null ? null : Number(body.accuracy);
      const speed = body.speed == null ? null : Number(body.speed);
      const heading = body.heading == null ? null : Number(body.heading);

      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
        sendError(res, 400, "VALIDATION", "Invalid latitude", "latitude");
        return;
      }
      if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
        sendError(res, 400, "VALIDATION", "Invalid longitude", "longitude");
        return;
      }

      const active = orders.listFor(req.user).filter((o) => o.status === "out_for_delivery");
      const updatedAt = new Date().toISOString();
      const save = db.prepare(
        `INSERT INTO rider_locations (order_id, rider_user_id, latitude, longitude, accuracy, speed, heading, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(order_id) DO UPDATE SET
           latitude = excluded.latitude, longitude = excluded.longitude, accuracy = excluded.accuracy,
           speed = excluded.speed, heading = excluded.heading, updated_at = excluded.updated_at`
      );

      const saved = [];
      db.transaction(() => {
        for (const order of active) {
          save.run(order.id, req.user.id, latitude, longitude, accuracy, speed, heading, updatedAt);
          saved.push(order);
        }
      })();

      for (const order of saved) {
        const payload = {
          orderId: order.id,
          code: order.code,
          riderId: req.user.id,
          location: { latitude, longitude, accuracy, speed, heading, updatedAt },
        };
        hub.publish("CUSTOMER", order.customerId, "rider.location", payload);
        const supplierId = orders.supplierOf(order);
        if (supplierId) hub.publish("SUPPLIER", supplierId, "rider.location", payload);
      }

      sendJson(res, 200, { data: { updatedAt, deliveries: saved.length } });
    })
  );

  function assigned(req, res) {
    const order = orders.getForUser(req.params.id, req.user);
    if (!order) sendError(res, 404, "NOT_FOUND", "Delivery not found");
    return order;
  }

  // ---- availability and activity -------------------------------------------

  const isOnline = (userId) =>
    (db.prepare("SELECT is_online AS online FROM users WHERE id = ?").get(userId) || {}).online !== 0;

  router.add(
    "GET",
    "/v1/rider/availability",
    approvedRider( (req, res) => {
      sendJson(res, 200, { data: { online: isOnline(req.user.id) } });
    })
  );

  // { online: true | false }. Offline riders cannot be given new deliveries;
  // deliveries already assigned stay with them.
  router.add(
    "PUT",
    "/v1/rider/availability",
    approvedRider( async (req, res) => {
      const body = await parseBody(req);
      if (typeof body.online !== "boolean") {
        sendError(res, 400, "VALIDATION", "online must be true or false", "online");
        return;
      }
      db.prepare("UPDATE users SET is_online = ? WHERE id = ?").run(body.online ? 1 : 0, req.user.id);
      sendJson(res, 200, { data: { online: body.online } });
    })
  );

  // Delivery activity for the signed-in rider. The app sends the start of the
  // rider's local day as ?since=<ISO time>; "last7Days" covers that day and the six before.
  router.add(
    "GET",
    "/v1/rider/summary",
    approvedRider( (req, res) => {
      const parsed = Date.parse(String(req.query.since || ""));
      const startOfToday = Number.isNaN(parsed) ? Date.now() - (Date.now() % 86400000) : parsed;
      const startOfWeek = startOfToday - 6 * 86400000;
      const rows = db
        .prepare(
          `SELECT o.id AS id, o.total_paise AS totalPaise, MAX(e.at) AS deliveredAt
             FROM orders o JOIN order_events e ON e.order_id = o.id AND e.to_status = 'delivered'
            WHERE o.rider_user_id = ? GROUP BY o.id`
        )
        .all(req.user.id);
      const within = (from) => rows.filter((r) => Date.parse(r.deliveredAt) >= from);
      const roll = (list) => ({
        deliveries: list.length,
        orderValuePaise: list.reduce((sum, r) => sum + Number(r.totalPaise || 0), 0),
      });
      const active = orders.listFor(req.user).filter((o) => ACTIVE.has(o.status)).length;
      sendJson(res, 200, {
        data: { online: isOnline(req.user.id), activeNow: active, today: roll(within(startOfToday)), last7Days: roll(within(startOfWeek)), allTime: roll(rows) },
      });
    })
  );

  router.add(
    "GET",
    "/v1/rider/orders",
    approvedRider( (req, res) => {
      const mine = orders.listFor(req.user).map((o) => orders.present(o, "RIDER"));
      sendJson(res, 200, {
        data: {
          active: mine.filter((o) => ACTIVE.has(o.status)),
          history: mine.filter((o) => DONE.has(o.status)),
        },
      });
    })
  );

  router.add(
    "POST",
    "/v1/rider/orders/:id/accept",
    approvedRider((req, res) => {
      const order = assigned(req, res);
      if (!order) return;
      const updated = orders.acceptDelivery(order.id, req.user.id);
      sendJson(res, 200, { data: orders.present(updated, "RIDER") });
    })
  );

  const riderStep = (event) =>
    approvedRider((req, res) => {
      const order = assigned(req, res);
      if (!order) return;
      const updated = orders.transition(order.id, event, "rider", undefined, { userId: req.user.id });
      sendJson(res, 200, { data: orders.present(updated, "RIDER") });
    });
  router.add("POST", "/v1/rider/orders/:id/pickup", riderStep("pickup"));
  router.add("POST", "/v1/rider/orders/:id/start", riderStep("start"));

  router.add(
    "POST",
    "/v1/rider/orders/:id/eta",
    approvedRider( async (req, res) => {
      const order = assigned(req, res);
      if (!order) return;
      const body = await parseBody(req);
      try {
        const updated = orders.setEta(order.id, body.eta, req.user.id);
        sendJson(res, 200, { data: orders.present(updated, "RIDER") });
      } catch (err) {
        sendError(res, err.status || 500, err.code || "SERVER_ERROR", err.message || "Could not update delivery time", err.field);
      }
    })
  );

  router.add(
    "POST",
    "/v1/rider/orders/:id/deliver",
    approvedRider( async (req, res) => {
      const order = assigned(req, res);
      if (!order) return;
      const body = await parseBody(req, 800 * 1024); // room for a compressed proof photo
      const amount = Number(body.amountCollectedPaise || 0);
      if (!Number.isFinite(amount) || amount < 0) {
        sendError(res, 400, "VALIDATION", "Invalid amount", "amountCollectedPaise");
        return;
      }
      // Proof is only asked for while the order is on its way; any other state is refused by the order machine below.
      let proof = { method: "none" };
      try {
        if (order.status === "out_for_delivery") proof = checkProof(order, body);
      } catch (err) {
        return sendError(res, err.status || 400, err.code || "PROOF_REQUIRED", err.message, err.field);
      }
      const result = deliveries.record({
        orderId: order.id,
        actorType: "rider",
        expectedVersion: body.expectedVersion,
        fullOut: wholeNumber(body.fullOut, "fullOut"),
        emptyIn: wholeNumber(body.emptyIn, "emptyIn"),
        paymentMode: String(body.paymentMode || "cash").slice(0, 20),
        amountCollectedPaise: amount,
        riderUserId: req.user.id,
      });
      saveProof(db, order, proof, req.user.id);
      sendJson(res, 201, {
        data: { order: orders.present(result.order, "RIDER"), delivery: result.delivery, proof: proof.method },
      });
    })
  );
}

module.exports = { registerRiderRoutes };
