const { MONEY_TYPE } = require("../../../../../packages/contracts/enums/money-type");

function createLedgerService(store) {
  function appendMoney(entry) {
    const row = {
      id: store.moneyEntries.length + 1,
      ...entry,
      createdAt: new Date().toISOString(),
    };
    store.moneyEntries.push(row);
    return row;
  }

  function appendContainer(entry) {
    const row = {
      id: store.containerEntries.length + 1,
      ...entry,
      createdAt: new Date().toISOString(),
    };
    store.containerEntries.push(row);
    return row;
  }

  function householdBalance(householdId) {
    const duePaise = store.moneyEntries
      .filter((row) => row.householdId === householdId)
      .reduce((sum, row) => sum + row.amountPaise * row.sign, 0);
    const cansHeld = store.containerEntries
      .filter((row) => row.toId === householdId)
      .reduce((sum, row) => sum + row.qty, 0)
      - store.containerEntries
        .filter((row) => row.fromId === householdId)
        .reduce((sum, row) => sum + row.qty, 0);
    return { householdId, duePaise, cansHeld };
  }

  function chargeForDelivery(order) {
    return appendMoney({
      supplierId: order.fulfillingSupplierId,
      householdId: order.householdId,
      type: MONEY_TYPE.charge,
      amountPaise: order.totalPaise,
      sign: 1,
      orderId: order.id,
    });
  }

  function paymentForDelivery(order, mode, amountPaise) {
    return appendMoney({
      supplierId: order.fulfillingSupplierId,
      householdId: order.householdId,
      type: MONEY_TYPE.payment,
      amountPaise,
      sign: -1,
      mode,
      orderId: order.id,
    });
  }

  return {
    appendMoney,
    appendContainer,
    householdBalance,
    chargeForDelivery,
    paymentForDelivery,
  };
}

module.exports = { createLedgerService };
