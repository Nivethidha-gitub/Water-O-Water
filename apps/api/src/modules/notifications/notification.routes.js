const { sendJson, sendError } = require("../../http/send");

function recipientOf(user) {
  if (user.role === "SUPPLIER") return { type: "SUPPLIER", id: user.supplierId };
  if (user.role === "RIDER") return { type: "RIDER", id: user.id };
  return { type: "CUSTOMER", id: user.customerId };
}

function registerNotificationRoutes(router, { notifications, hub, guard }) {
  router.add(
    "GET",
    "/v1/notifications",
    guard(null, (req, res) => {
      const r = recipientOf(req.user);
      sendJson(res, 200, { data: notifications.listFor(r.type, r.id) });
    })
  );

  router.add(
    "POST",
    "/v1/notifications/read-all",
    guard(null, (req, res) => {
      const r = recipientOf(req.user);
      const count = notifications.markAllRead(r.type, r.id);
      sendJson(res, 200, { data: { updated: count } });
    })
  );

  router.add(
    "POST",
    "/v1/notifications/:id/read",
    guard(null, (req, res) => {
      const r = recipientOf(req.user);
      const result = notifications.markRead(r.type, r.id, req.params.id);
      if (!result.notification) {
        sendError(res, 404, "NOT_FOUND", "Notification not found");
        return;
      }
      sendJson(res, 200, { data: result.notification });
    })
  );

  // Real-time stream. The client authenticates with the Authorization
  // header (fetch streaming), so the token never appears in a URL.
  router.add(
    "GET",
    "/v1/events",
    guard(null, (req, res) => {
      const r = recipientOf(req.user);
      hub.subscribe(req, res, r);
    })
  );
}

module.exports = { registerNotificationRoutes, recipientOf };
