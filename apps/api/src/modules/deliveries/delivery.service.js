const { newId } = require("../../store/ids");

function createDeliveryService(store, orderService, ledgerService) {
  function record(input) {
    const order = orderService.transition(
      input.orderId,
      "deliver",
      input.actorType || "rider",
      input.expectedVersion,
      { userId: input.riderUserId }
    );
    const delivery = {
      id: newId(),
      orderId: order.id,
      riderUserId: input.riderUserId,
      fullOut: Number(input.fullOut),
      emptyIn: Number(input.emptyIn),
      paymentMode: input.paymentMode,
      amountCollectedPaise: Number(input.amountCollectedPaise || 0),
      deliveredAt: new Date().toISOString(),
    };
    store.deliveries.push(delivery);
    ledgerService.appendContainer({
      supplierId: order.fulfillingSupplierId,
      fill: "full",
      qty: delivery.fullOut,
      fromKind: "rider",
      fromId: delivery.riderUserId,
      toKind: "customer",
      toId: order.householdId,
      orderId: order.id,
      reason: "delivery_full_out",
    });
    if (delivery.emptyIn > 0) {
      ledgerService.appendContainer({
        supplierId: order.fulfillingSupplierId,
        fill: "empty",
        qty: delivery.emptyIn,
        fromKind: "customer",
        fromId: order.householdId,
        toKind: "rider",
        toId: delivery.riderUserId,
        orderId: order.id,
        reason: "delivery_empty_in",
      });
    }
    ledgerService.chargeForDelivery(order);
    if (delivery.amountCollectedPaise > 0) {
      ledgerService.paymentForDelivery(
        order,
        delivery.paymentMode,
        delivery.amountCollectedPaise
      );
    }
    return { order, delivery };
  }

  return { record };
}

module.exports = { createDeliveryService };
