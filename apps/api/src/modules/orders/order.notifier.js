/*
 * Turns order lifecycle events into notifications. Every event is emitted by the order service
 * only AFTER the database change has committed, so no notification exists for a change that failed.
 *
 *   customer places order  ->  "placed"     ->  notify the order's supplier + confirm to the customer
 *   status changes         ->  "transition" ->  notify the customer, supplier and assigned rider
 *   rider assigned/changed ->  "updated"    ->  notify the new rider, the customer, the previous rider
 *   rider accepts / ETA    ->  "updated"    ->  notify the supplier / the customer and supplier
 *   fallback re-assigns    ->  "updated"    ->  notify the new supplier
 *
 * Recipients are always resolved from the order (supplierId / customerId / riderUserId),
 * never broadcast. Each notification carries a dedupe key built from the order's version, so the same
 * change processed twice (a retry, a replay) is stored and delivered once.
 */
const STATUS_TEXT = {
  placed: "placed",
  accepted: "accepted",
  preparing: "being prepared",
  ready_for_pickup: "ready for pickup",
  picked_up: "picked up by the rider",
  fallback_offered: "being re-assigned",
  out_for_delivery: "out for delivery",
  delivered: "delivered",
  cancelled: "cancelled",
  exception: "delayed",
  failed: "unfulfilled",
  settled: "settled",
};

function summary(order, orders) {
  return order.items && order.items.length
    ? order.items.map((i) => i.qty + " × " + i.name).join(", ")
    : order.qty + " items";
}

// One key per order change: the order version moves on with every change, so a repeat of the
// same change maps to the same key and is dropped by the notification service.
const keyOf = (order, tag) => "order:" + order.id + ":v" + order.version + ":" + tag;

function attachOrderNotifier({ orders, notifications }) {
  orders.on((kind, order, meta) => {
    const supplierId = orders.supplierOf(order);

    if (kind === "lowStock") {
      for (const p of meta.products || []) {
        notifications.notify({
          recipientType: "SUPPLIER",
          recipientId: supplierId,
          type: "stock.low",
          orderId: order.id,
          title: p.stockQty === 0 ? p.name + " is out of stock" : p.name + " is running low",
          body: p.stockQty === 0 ? "Restock to keep taking orders." : "Only " + p.stockQty + " left.",
          event: "stock.low",
        });
      }
      return;
    }

    if (kind === "placed") {
      const view = orders.present(order, "SUPPLIER");
      notifications.notify({
        recipientType: "SUPPLIER",
        recipientId: supplierId,
        type: "order.created",
        orderId: order.id,
        title: "New order " + order.code,
        body:
          (view.customer ? view.customer.name + " · " : "") + summary(view, orders),
        event: "order.created",
        order: view,
        dedupeKey: keyOf(order, "placed"),
      });
      // The customer gets a confirmation that the order really went through.
      const customerView = orders.present(order, "CUSTOMER");
      const placedWith = (customerView.supplier && customerView.supplier.name) || "your supplier";
      notifications.notify({
        recipientType: "CUSTOMER",
        recipientId: order.customerId,
        type: "order.placed",
        orderId: order.id,
        title: "Order " + order.code + " placed",
        body: "Waiting for " + placedWith + " to accept. " + summary(customerView, orders),
        event: "order.updated",
        order: customerView,
        dedupeKey: keyOf(order, "placed"),
      });
      return;
    }

    // The supplier turned the order down: tell the customer clearly, with the reason and what they can do next.
    if (kind === "declined") {
      const view = orders.present(order, "CUSTOMER");
      const supplierName = (view.supplier && view.supplier.name) || "Your supplier";
      const paidOnline = order.paymentMethod === "UPI" && order.paymentStatus === "PAID";
      notifications.notify({
        recipientType: "CUSTOMER",
        recipientId: order.customerId,
        type: "order.declined",
        orderId: order.id,
        title: supplierName + " could not accept order " + order.code,
        body:
          (meta.reason ? "Reason: " + meta.reason + ". " : "") +
          (paidOnline
            ? "Cancel the order for a full refund, or order from another supplier."
            : "You can cancel the order or order from another supplier."),
        event: "order.updated",
        order: view,
        dedupeKey: keyOf(order, "declined"),
      });
      return;
    }

    if (kind === "transition") {
      // A decline is announced by the "declined" message above, once the reason is saved.
      if (meta.event === "decline") return;
      const label = STATUS_TEXT[order.status] || order.status;
      // Clear, friendly wording for the steps the customer cares about.
      const CUSTOMER_COPY = {
        accepted: ["Order " + order.code + " accepted", "The supplier accepted your order."],
        preparing: ["Order " + order.code + " is being prepared", "Your cans are being filled and packed."],
        ready_for_pickup: ["Order " + order.code + " is ready", "Waiting for the delivery partner to pick it up."],
        picked_up: ["Order " + order.code + " picked up", (order.riderName || "The rider") + " has collected your order."],
        out_for_delivery: ["Order " + order.code + " is out for delivery", "Your delivery is on the way. Keep your delivery code ready."],
        delivered: ["Order " + order.code + " delivered", "Your order was delivered successfully. Enjoy your fresh water!"],
        cancelled: [
          "Order " + order.code + " cancelled",
          meta.actorType === "customer" ? "You cancelled this order." : "This order was cancelled.",
        ],
        exception: ["Order " + order.code + " is delayed", "Your delivery ran into a delay. We will update you as soon as it is moving again."],
        failed: ["Order " + order.code + " could not be completed", "This order could not be fulfilled."],
      };
      const copy = CUSTOMER_COPY[order.status];
      notifications.notify({
        recipientType: "CUSTOMER",
        recipientId: order.customerId,
        type: "order.updated",
        orderId: order.id,
        title: copy ? copy[0] : "Order " + order.code + " " + label,
        body: copy ? copy[1] : "Status: " + label,
        event: "order.updated",
        order: orders.present(order, "CUSTOMER"),
        dedupeKey: keyOf(order, "status:" + order.status),
      });
      // The rider is told when the supplier has the order ready for them.
      if (order.status === "ready_for_pickup" && order.riderUserId) {
        notifications.notify({
          recipientType: "RIDER",
          recipientId: order.riderUserId,
          type: "delivery.ready",
          orderId: order.id,
          title: "Order " + order.code + " is ready for pickup",
          body: "Collect it from the supplier, then mark it as picked up.",
          event: "order.updated",
          order: orders.present(order, "RIDER"),
          dedupeKey: keyOf(order, "status:" + order.status),
        });
      }
      // The assigned rider is told when the delivery is called off, or needs attention from someone else.
      if (order.riderUserId && (order.status === "cancelled" || order.status === "failed")) {
        notifications.notify({
          recipientType: "RIDER",
          recipientId: order.riderUserId,
          type: "delivery.cancelled",
          orderId: order.id,
          title: "Delivery " + order.code + " " + (order.status === "cancelled" ? "cancelled" : "called off"),
          body: "No pickup or delivery is needed for this order any more.",
          event: "order.updated",
          order: orders.present(order, "RIDER"),
          dedupeKey: keyOf(order, "status:" + order.status),
        });
      } else if (order.riderUserId && order.status === "exception" && meta.actorType !== "rider") {
        notifications.notify({
          recipientType: "RIDER",
          recipientId: order.riderUserId,
          type: "delivery.attention",
          orderId: order.id,
          title: "Delivery " + order.code + " needs attention",
          body: "This delivery was flagged as delayed. Open it to check the details.",
          event: "order.updated",
          order: orders.present(order, "RIDER"),
          dedupeKey: keyOf(order, "status:" + order.status),
        });
      }
      // Keep every open supplier tab in sync too (no inbox entry needed
      // for the supplier's own action, but customer cancels matter).
      if (meta.actorType === "customer" || meta.actorType === "system" || meta.actorType === "rider") {
        const needsAction = order.status === "exception" || order.status === "failed";
        notifications.notify({
          recipientType: "SUPPLIER",
          recipientId: supplierId,
          type: "order.updated",
          orderId: order.id,
          title: needsAction ? "Order " + order.code + " needs your attention" : "Order " + order.code + " " + label,
          body: needsAction ? "The delivery is " + label + ". Open the order to decide what to do next." : "Status: " + label,
          event: "order.updated",
          order: orders.present(order, "SUPPLIER"),
          dedupeKey: keyOf(order, "status:" + order.status),
        });
      }
      return;
    }

    if (kind === "updated" && meta && meta.riderAccepted) {
      notifications.notify({
        recipientType: "SUPPLIER",
        recipientId: supplierId,
        type: "order.updated",
        orderId: order.id,
        title: (order.riderName || "The rider") + " accepted " + order.code,
        body: "The delivery partner will pick it up when it is ready.",
        event: "order.updated",
        order: orders.present(order, "SUPPLIER"),
        dedupeKey: keyOf(order, "rider-accepted"),
      });
      return;
    }

    if (kind === "updated" && meta && meta.etaChanged) {
      notifications.notify({
        recipientType: "CUSTOMER",
        recipientId: order.customerId,
        type: "order.updated",
        orderId: order.id,
        title: "Delivery time updated for " + order.code,
        body: (order.eta || "Delivery time updated"),
        event: "order.updated",
        order: orders.present(order, "CUSTOMER"),
        dedupeKey: keyOf(order, "eta"),
      });
      notifications.notify({
        recipientType: "SUPPLIER",
        recipientId: supplierId,
        type: "order.updated",
        orderId: order.id,
        title: "Delivery time updated for " + order.code,
        body: (order.eta || "Delivery time updated"),
        event: "order.updated",
        order: orders.present(order, "SUPPLIER"),
        dedupeKey: keyOf(order, "eta"),
      });
      return;
    }

    if (kind === "updated" && meta && meta.riderAssigned) {
      const supplierView = orders.present(order, "RIDER");
      notifications.notify({
        recipientType: "RIDER",
        recipientId: order.riderUserId,
        type: "delivery.assigned",
        orderId: order.id,
        title: "New delivery " + order.code,
        body:
          (supplierView.customer ? supplierView.customer.name + " · " : "") +
          summary(supplierView, orders),
        event: "order.updated",
        order: supplierView,
        dedupeKey: keyOf(order, "rider-assigned"),
      });
      notifications.notify({
        recipientType: "CUSTOMER",
        recipientId: order.customerId,
        type: "order.updated",
        orderId: order.id,
        title: "Rider assigned to " + order.code,
        body: (order.riderName || "A rider") + " will deliver your cans",
        event: "order.updated",
        order: orders.present(order, "CUSTOMER"),
        dedupeKey: keyOf(order, "rider-assigned"),
      });
      // A rider who was taken off this delivery is told it changed (no order link: they can no longer open it).
      if (meta.previousRiderUserId && meta.previousRiderUserId !== order.riderUserId) {
        notifications.notify({
          recipientType: "RIDER",
          recipientId: meta.previousRiderUserId,
          type: "delivery.changed",
          orderId: null,
          title: "Delivery " + order.code + " was reassigned",
          body: "The supplier gave this delivery to another delivery partner. Nothing more to do for it.",
          event: "order.updated",
          dedupeKey: keyOf(order, "rider-removed"),
        });
      }
      return;
    }

    if (kind === "updated" && meta && meta.reassigned) {
      notifications.notify({
        recipientType: "SUPPLIER",
        recipientId: supplierId,
        type: "order.assigned",
        orderId: order.id,
        title: "Order " + order.code + " assigned to you",
        body: summary(orders.present(order, "SUPPLIER"), orders),
        event: "order.created",
        order: orders.present(order, "SUPPLIER"),
        dedupeKey: keyOf(order, "reassigned:" + supplierId),
      });
    }
  });
}

module.exports = { attachOrderNotifier };
