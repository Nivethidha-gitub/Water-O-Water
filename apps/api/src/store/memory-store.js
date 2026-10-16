function createStore() {
  return {
    suppliers: [],
    users: [],
    members: [],
    households: [],
    customers: [],
    addresses: [],
    products: [],
    orders: [],
    orderEvents: [],
    deliveries: [],
    containerEntries: [],
    moneyEntries: [],
    cashEntries: [],
    dispatchOffers: [],
    waMessages: [],
    conversations: [],
  };
}

module.exports = { createStore };
