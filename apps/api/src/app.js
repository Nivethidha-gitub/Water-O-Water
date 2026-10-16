const db = require("./db/database");
const config = require("./config");
const { ensureSchema } = require("./db/schema");
const { createRouter } = require("./http/router");
const { createGuard } = require("./http/guard");
const { sendError } = require("./http/send");
const { createStore } = require("./store/memory-store");
const { seedDirectory, loadDirectory } = require("./store/directory");
const { seedDemoData } = require("./seed/demo-data");
const { seedOrders } = require("./seed/seed-orders");
const { seedDemoUsers } = require("./seed/demo-users");
const { createHub } = require("./realtime/hub");
const { createAuthService } = require("./modules/identity/auth.service");
const { createOrderService } = require("./modules/orders/order.service");
const { attachOrderNotifier } = require("./modules/orders/order.notifier");
const { createNotificationService } = require("./modules/notifications/notification.service");
const { createSseChannel } = require("./modules/notifications/channels/sse.channel");
const { createPushChannel } = require("./modules/notifications/channels/push.channel");
const { createLedgerService } = require("./modules/ledger/ledger.service");
const { createDeliveryService } = require("./modules/deliveries/delivery.service");
const { createFallbackService } = require("./modules/dispatch/fallback.service");
const { createConversationService } = require("./modules/whatsapp/conversation.service");
const { registerCatalogRoutes } = require("./modules/catalog/catalog.routes");
const { registerAuthRoutes } = require("./modules/identity/auth.routes");
const { registerOrderRoutes } = require("./modules/orders/order.routes");
const { registerNotificationRoutes } = require("./modules/notifications/notification.routes");
const { registerLedgerRoutes } = require("./modules/ledger/ledger.routes");
const { registerDeliveryRoutes } = require("./modules/deliveries/delivery.routes");
const { registerRiderRoutes } = require("./modules/riders/rider.routes");
const { registerFallbackRoutes } = require("./modules/dispatch/fallback.routes");
const { registerWhatsappRoutes } = require("./modules/whatsapp/webhook.routes");
const { registerPaymentRoutes } = require("./modules/payments/payment.routes");
const { registerAddressRoutes } = require("./modules/addresses/addresses.routes");

async function createApp() {
  ensureSchema();

  // Demo directory + orders go into SQLite once; the in-memory store is a cache.
  const store = createStore();
  seedDemoData(store);
  seedDirectory(store);
  seedOrders(store);
  loadDirectory(store);

  if (config.seedDemoUsers) await seedDemoUsers();

  // Services
  const hub = createHub();
  const notifications = createNotificationService();
  notifications.addChannel(createSseChannel(hub));
  notifications.addChannel(createPushChannel(config)); // no-op unless PUSH_PROVIDER is set

  const auth = createAuthService(store, { onDirectoryChanged: () => loadDirectory(store) });
  const guard = createGuard(auth);

  const orders = createOrderService(store);
  orders.reload();
  attachOrderNotifier({ orders, notifications });

  const ledger = createLedgerService(store);
  const deliveries = createDeliveryService(store, orders, ledger);
  const fallback = createFallbackService(store, orders);
  const conversation = createConversationService(store, orders);

  const ctx = { db, store, hub, auth, guard, notifications, orders, ledger, deliveries, fallback, conversation };

  const router = createRouter();
  registerCatalogRoutes(router, ctx);
  registerAuthRoutes(router, ctx);
  registerOrderRoutes(router, ctx);
  registerNotificationRoutes(router, ctx);
  registerLedgerRoutes(router, ctx);
  registerDeliveryRoutes(router, ctx);
  registerRiderRoutes(router, ctx);
  registerFallbackRoutes(router, ctx);
  registerWhatsappRoutes(router, ctx);
  registerPaymentRoutes(router, ctx);
  registerAddressRoutes(router, ctx);

  const purge = setInterval(() => auth.purgeExpiredSessions(), 60 * 60 * 1000);
  purge.unref();
  auth.purgeExpiredSessions();

  return { router, services: ctx, ...ctx };
}

async function handleRequest(app, req, res) {
  try {
    const matched = await app.router.handle(req, res);
    if (!matched) {
      sendError(res, 404, "NOT_FOUND", "No API route for " + req.url.split("?")[0]);
    }
  } catch (err) {
    if (res.headersSent) {
      res.end();
      return;
    }
    if (err && err.status) {
      sendError(res, err.status, err.code || "ERROR", err.message, err.field);
      return;
    }
    console.error("Unhandled error:", err);
    sendError(res, 500, "INTERNAL_ERROR", "Something went wrong");
  }
}

module.exports = { createApp, handleRequest };
