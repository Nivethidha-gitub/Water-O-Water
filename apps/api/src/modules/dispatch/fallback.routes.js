const db = require("../../db/database");
const { parseBody } = require("../../http/parse-body");
const { sendJson, sendError } = require("../../http/send");

/*
 * Fallback (re-assignment) flow. A supplier can only act on orders currently
 * assigned to them; a customer only on their own orders.
 */
function registerFallbackRoutes(router, { orders, fallback, guard }) {
  const mine = (req, res) => {
    const order = orders.getForUser(req.params.id, req.user);
    if (!order) sendError(res, 404, "NOT_FOUND", "Order not found");
    return order;
  };

  router.add(
    "GET",
    "/v1/ops/fallback-queue",
    guard(["SUPPLIER"], (req, res) => {
      const queue = fallback.queue().filter((o) => orders.isParty(o, req.user));
      sendJson(res, 200, { data: queue.map((o) => orders.present(o, "SUPPLIER")) });
    })
  );

  router.add(
    "POST",
    "/v1/orders/:id/timeout",
    guard(["SUPPLIER"], (req, res) => {
      const order = mine(req, res);
      if (!order) return;
      sendJson(res, 200, { data: orders.present(fallback.offerBackup(order.id), "SUPPLIER") });
    })
  );

  router.add(
    "POST",
    "/v1/orders/:id/fallback-yes",
    guard(["CUSTOMER"], (req, res) => {
      const order = mine(req, res);
      if (!order) return;
      sendJson(res, 200, { data: orders.present(fallback.customerYes(order.id), "CUSTOMER") });
    })
  );

  router.add(
    "POST",
    "/v1/ops/orders/:id/fallback-assign",
    guard(["SUPPLIER"], async (req, res) => {
      const order = mine(req, res);
      if (!order) return;
      const body = await parseBody(req);
      const target = db
        .prepare("SELECT id FROM suppliers WHERE id = ? AND status = 'verified'")
        .get(String(body.supplierId || ""));
      if (!target || target.id === req.user.supplierId) {
        sendError(res, 400, "VALIDATION", "Choose a different verified supplier", "supplierId");
        return;
      }
      sendJson(res, 200, { data: orders.present(fallback.assign(order.id, target.id), "SUPPLIER") });
    })
  );
}

module.exports = { registerFallbackRoutes };
