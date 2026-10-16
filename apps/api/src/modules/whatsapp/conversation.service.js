const { ORDER_SOURCE } = require("../../../../../packages/contracts/enums/order-source");
const { newId } = require("../../store/ids");

function createConversationService(store, orderService) {
  function inbound(text, customerId) {
    const customer = store.customers.find((row) => row.id === customerId);
    if (!customer) return { reply: "Unknown customer.", order: null };
    const message = {
      id: newId(),
      direction: "in",
      customerId,
      payload: { text },
      createdAt: new Date().toISOString(),
    };
    store.waMessages.push(message);
    const lower = String(text || "").trim().toLowerCase();
    if (lower === "hi" || lower.startsWith("order")) {
      const order = orderService.place({
        householdId: customer.householdId,
        customerId: customer.id,
        addressId: "addr-annanagar",
        supplierId: "sup-murugan",
        items: [{ productId: "prod-20l", qty: 2 }],
        source: ORDER_SOURCE.whatsapp,
        actorType: "customer",
      });
      return {
        reply: "2 cans from Murugan Water, ₹40 each, today 4–7 pm? Waiting for accept.",
        order,
      };
    }
    if (lower === "bal") {
      return { reply: "Cans held and amount due are on the BAL screen in the app.", order: null };
    }
    return { reply: "Send HI to reorder, or BAL for your ledger.", order: null };
  }

  return { inbound };
}

module.exports = { createConversationService };
