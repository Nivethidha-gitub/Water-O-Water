const ORDER_STATUS = Object.freeze({
  placed: "placed",
  accepted: "accepted",
  preparing: "preparing",
  readyForPickup: "ready_for_pickup",
  pickedUp: "picked_up",
  fallbackOffered: "fallback_offered",
  outForDelivery: "out_for_delivery",
  delivered: "delivered",
  exception: "exception",
  settled: "settled",
  cancelled: "cancelled",
  failed: "failed",
});

module.exports = { ORDER_STATUS };
