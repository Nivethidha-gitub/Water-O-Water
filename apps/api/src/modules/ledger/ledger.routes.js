const { sendJson, sendError } = require("../../http/send");

/* A household's balance is visible to that household and to its suppliers. */
function registerLedgerRoutes(router, { ledger, orders, guard }) {
  router.add(
    "GET",
    "/v1/balances/:householdId",
    guard(["CUSTOMER", "SUPPLIER"], (req, res) => {
      const householdId = req.params.householdId;
      const allowed = orders
        .listFor(req.user)
        .some((order) => order.householdId === householdId);
      if (!allowed) {
        sendError(res, 404, "NOT_FOUND", "Household not found");
        return;
      }
      sendJson(res, 200, { data: ledger.householdBalance(householdId) });
    })
  );
}

module.exports = { registerLedgerRoutes };
