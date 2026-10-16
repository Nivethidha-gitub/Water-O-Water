const config = require("../../config");
const { parseBody } = require("../../http/parse-body");
const { sendJson, sendError } = require("../../http/send");

/*
 * WhatsApp simulator webhook. Open in development so the demo works; in
 * production it needs the shared secret in the x-webhook-secret header.
 */
function registerWhatsappRoutes(router, { conversation, orders, store }) {
  const allowed = (req) =>
    !config.isProduction ||
    (config.whatsappSecret && req.headers["x-webhook-secret"] === config.whatsappSecret);

  router.add("GET", "/v1/webhooks/whatsapp", (req, res) => {
    sendJson(res, 200, { data: { challenge: req.query["hub.challenge"] || "ok" } });
  });

  router.add("POST", "/v1/webhooks/whatsapp", async (req, res) => {
    if (!allowed(req)) {
      sendError(res, 403, "FORBIDDEN", "Webhook secret required");
      return;
    }
    const body = await parseBody(req);
    const customerId = body.customerId || "cust-ayesha";
    if (!store.customers.some((c) => c.id === customerId)) {
      sendError(res, 404, "NOT_FOUND", "Customer not found");
      return;
    }
    const result = conversation.inbound(String(body.text || "").slice(0, 500), customerId);
    sendJson(res, 200, {
      data: { reply: result.reply, order: result.order ? orders.present(result.order, "SUPPLIER") : null },
    });
  });

  if (!config.isProduction) {
    router.add("GET", "/v1/whatsapp/messages", (req, res) => {
      sendJson(res, 200, { data: store.waMessages });
    });
  }
}

module.exports = { registerWhatsappRoutes };
