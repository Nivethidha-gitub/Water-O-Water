const { ORDER_STATUS } = require("../../../../../packages/contracts/enums/order-status");
const { newId } = require("../../store/ids");
const config = require("../../config");

function createFallbackService(store, orderService) {
  function queue() {
    return store.orders.filter((order) => {
      return order.status === ORDER_STATUS.fallbackOffered;
    });
  }

  function offerBackup(orderId) {
    const order = orderService.transition(orderId, "timeout", "system");
    store.dispatchOffers.push({
      id: newId(),
      orderId: order.id,
      candidateSupplierId: null,
      status: "offered",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
    return order;
  }

  function customerYes(orderId) {
    const order = orderService.transition(orderId, "customer_yes", "customer");
    order.customerConsentedFallback = true;
    return orderService.update(order);
  }

  function assign(orderId, backupSupplierId) {
    const order = orderService.transition(orderId, "fallback_assign", "ops");
    order.fulfillingSupplierId = backupSupplierId;
    order.isFallback = true;
    order.fallbackFeePaise = config.fallbackFeePaise;
    return orderService.update(order, { reassigned: true });
  }

  return { queue, offerBackup, customerYes, assign };
}

module.exports = { createFallbackService };
