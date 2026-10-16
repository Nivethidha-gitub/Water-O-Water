const { sendError } = require("../../http/send");

/*
 * Completing a delivery is the assigned rider's job only (POST /v1/rider/orders/:id/deliver),
 * and it needs the customer's delivery code or a proof photo. A supplier can prepare an order and
 * hand it to a rider, but can never mark it delivered. This route used to let them; it now answers
 * with a clear refusal so an old app version cannot create a false "Delivered" status.
 */
function registerDeliveryRoutes(router, { guard }) {
  router.add(
    "POST",
    "/v1/deliveries",
    guard(["SUPPLIER"], (req, res) => {
      sendError(
        res,
        403,
        "SUPPLIER_CANNOT_DELIVER",
        "Only the assigned rider can mark an order as delivered, after handing it over to the customer"
      );
    })
  );
}

module.exports = { registerDeliveryRoutes };
