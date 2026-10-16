
const { ORDER_STATUS } = require("../../../../packages/contracts/enums/order-status");
const { ORDER_SOURCE } = require("../../../../packages/contracts/enums/order-source");
const { SERVICE_TYPE } = require("../../../../packages/contracts/enums/service-type");
const { PAY_MODE } = require("../../../../packages/contracts/enums/pay-mode");
const { MONEY_TYPE } = require("../../../../packages/contracts/enums/money-type");

function seedDemoData(store) {
  // ---------------------------------------------------------
  // SUPPLIERS
  // ---------------------------------------------------------
  store.suppliers.push(
    {
      id: "sup-murugan",
      name: "Murugan Water",
      phone: "+919876540001",
      status: "verified",
      plan: "network",
      reliabilityScore: 96.4,
    },
    {
      id: "sup-balaji",
      name: "Sri Balaji Water",
      phone: "+919876540002",
      status: "verified",
      plan: "network",
      reliabilityScore: 91.2,
    }
  );

  // ---------------------------------------------------------
  // USERS
  // ---------------------------------------------------------
  store.users.push(
    {
      id: "user-owner",
      name: "Murugan",
      phone: "+919876540001",
      role: "owner",
    },
    {
      id: "user-rider",
      name: "Murugan Rider",
      phone: "+919876540011",
      role: "rider",
    }
  );

  // ---------------------------------------------------------
  // HOUSEHOLDS
  // ---------------------------------------------------------
  store.households.push(
    { id: "hh-ayesha" },
    { id: "hh-priya" },
    { id: "hh-kavya" },
    { id: "hh-rahul" },
    { id: "hh-arun" }
  );

  // ---------------------------------------------------------
  // CUSTOMERS
  // ---------------------------------------------------------
  store.customers.push(
    {
      id: "cust-ayesha",
      householdId: "hh-ayesha",
      name: "Ayesha R.",
      phone: "+919812340001",
      locale: "ta",
    },
    {
      id: "cust-priya",
      householdId: "hh-priya",
      name: "Priya S.",
      phone: "+919812340002",
      locale: "en",
    },
    {
      id: "cust-kavya",
      householdId: "hh-kavya",
      name: "Kavya M.",
      phone: "+919812340003",
      locale: "en",
    },
    {
      id: "cust-rahul",
      householdId: "hh-rahul",
      name: "Rahul K.",
      phone: "+919812340004",
      locale: "en",
    },
    {
      id: "cust-arun",
      householdId: "hh-arun",
      name: "Arun P.",
      phone: "+919812340005",
      locale: "en",
    }
  );

  // ---------------------------------------------------------
  // ADDRESSES
  // ---------------------------------------------------------
  store.addresses.push(
    {
      id: "addr-annanagar",
      householdId: "hh-ayesha",
      line: "Anna Nagar, Chennai",
      deliveryPref: "door",
    },
    {
      id: "addr-gandhipuram",
      householdId: "hh-priya",
      line: "Gandhipuram, Coimbatore",
      deliveryPref: "door",
    },
    {
      id: "addr-peelamedu",
      householdId: "hh-kavya",
      line: "Peelamedu, Coimbatore",
      deliveryPref: "door",
    },
    {
      id: "addr-rspuram",
      householdId: "hh-rahul",
      line: "RS Puram, Coimbatore",
      deliveryPref: "door",
    },
    {
      id: "addr-saibaba",
      householdId: "hh-arun",
      line: "Saibaba Colony, Coimbatore",
      deliveryPref: "door",
    }
  );

  // ---------------------------------------------------------
  // PRODUCTS
  // ---------------------------------------------------------
  store.products.push(
    {
      id: "prod-20l",
      supplierId: "sup-murugan",
      sku: "CAN20",
      nameEn: "20L Can",
      nameTa: "20லி கேன்",
      unitPricePaise: 4000,
      serviceType: SERVICE_TYPE.exchange,
    },
    {
      id: "prod-20l-balaji",
      supplierId: "sup-balaji",
      sku: "CAN20-B",
      nameEn: "20L Can -  Water",
      nameTa: "20லி கேன்",
      unitPricePaise: 4500,
      serviceType: SERVICE_TYPE.exchange,
    }
  );

  // ---------------------------------------------------------
  // ORDERS
  // ---------------------------------------------------------

  // Ayesha
  store.orders.push({
    id: "ord-10432",
    code: "AR-10432",
    householdId: "hh-ayesha",
    customerId: "cust-ayesha",
    addressId: "addr-annanagar",
    primarySupplierId: "sup-murugan",
    fulfillingSupplierId: "sup-murugan",
    productId: "prod-20l",
    qty: 2,
    unitPricePaise: 4000,
    totalPaise: 8000,
    source: ORDER_SOURCE.whatsapp,
    status: ORDER_STATUS.outForDelivery,
    isFallback: false,
    customerConsentedFallback: false,
    version: 3,
    riderName: "Murugan",
    eta: "today by 6:30 PM",
    createdAt: new Date().toISOString(),
  });

  // Priya
  store.orders.push({
    id: "ord-10433",
    code: "PR-10433",
    householdId: "hh-priya",
    customerId: "cust-priya",
    addressId: "addr-gandhipuram",
    primarySupplierId: "sup-balaji",
    fulfillingSupplierId: "sup-balaji",
    productId: "prod-20l-balaji",
    qty: 1,
    unitPricePaise: 4500,
    totalPaise: 4500,
    source: ORDER_SOURCE.web,
    status: ORDER_STATUS.accepted,
    isFallback: false,
    customerConsentedFallback: false,
    version: 2,
    riderName: "Balaji Rider",
    eta: "today by 7:00 PM",
    createdAt: new Date().toISOString(),
  });

  // Kavya
  store.orders.push({
    id: "ord-10434",
    code: "KV-10434",
    householdId: "hh-kavya",
    customerId: "cust-kavya",
    addressId: "addr-peelamedu",
    primarySupplierId: "sup-murugan",
    fulfillingSupplierId: "sup-murugan",
    productId: "prod-20l",
    qty: 3,
    unitPricePaise: 4000,
    totalPaise: 12000,
    source: ORDER_SOURCE.web,
    status: ORDER_STATUS.accepted,
    isFallback: false,
    customerConsentedFallback: false,
    version: 2,
    riderName: "Murugan Rider",
    eta: "tomorrow by 10:00 AM",
    createdAt: new Date().toISOString(),
  });

  // Rahul
  store.orders.push({
    id: "ord-10435",
    code: "RK-10435",
    householdId: "hh-rahul",
    customerId: "cust-rahul",
    addressId: "addr-rspuram",
    primarySupplierId: "sup-balaji",
    fulfillingSupplierId: "sup-balaji",
    productId: "prod-20l-balaji",
    qty: 1,
    unitPricePaise: 4500,
    totalPaise: 4500,
    source: ORDER_SOURCE.web,
    status: ORDER_STATUS.outForDelivery,
    isFallback: false,
    customerConsentedFallback: false,
    version: 3,
    riderName: "Balaji Rider",
    eta: "today by 5:30 PM",
    createdAt: new Date().toISOString(),
  });

  // Arun
  store.orders.push({
    id: "ord-10436",
    code: "AP-10436",
    householdId: "hh-arun",
    customerId: "cust-arun",
    addressId: "addr-saibaba",
    primarySupplierId: "sup-murugan",
    fulfillingSupplierId: "sup-murugan",
    productId: "prod-20l",
    qty: 2,
    unitPricePaise: 4000,
    totalPaise: 8000,
    source: ORDER_SOURCE.web,
    status: ORDER_STATUS.accepted,
    isFallback: false,
    customerConsentedFallback: false,
    version: 2,
    riderName: "Murugan Rider",
    eta: "today by 8:00 PM",
    createdAt: new Date().toISOString(),
  });

  // ---------------------------------------------------------
  // ORDER EVENTS
  // ---------------------------------------------------------

  store.orderEvents.push(
    {
      orderId: "ord-10432",
      fromStatus: ORDER_STATUS.accepted,
      toStatus: ORDER_STATUS.outForDelivery,
      actorType: "rider",
      reason: "start",
      at: new Date().toISOString(),
    },
    {
      orderId: "ord-10433",
      fromStatus: ORDER_STATUS.placed,
      toStatus: ORDER_STATUS.accepted,
      actorType: "owner",
      reason: "accepted",
      at: new Date().toISOString(),
    },
    {
      orderId: "ord-10434",
      fromStatus: ORDER_STATUS.placed,
      toStatus: ORDER_STATUS.accepted,
      actorType: "owner",
      reason: "accepted",
      at: new Date().toISOString(),
    },
    {
      orderId: "ord-10435",
      fromStatus: ORDER_STATUS.accepted,
      toStatus: ORDER_STATUS.outForDelivery,
      actorType: "rider",
      reason: "start",
      at: new Date().toISOString(),
    },
    {
      orderId: "ord-10436",
      fromStatus: ORDER_STATUS.placed,
      toStatus: ORDER_STATUS.accepted,
      actorType: "owner",
      reason: "accepted",
      at: new Date().toISOString(),
    }
  );

  // ---------------------------------------------------------
  // MONEY / LEDGER ENTRIES
  // ---------------------------------------------------------

  store.moneyEntries.push(
    {
      id: 1,
      supplierId: "sup-murugan",
      householdId: "hh-ayesha",
      type: MONEY_TYPE.charge,
      amountPaise: 8000,
      sign: 1,
      mode: PAY_MODE.upi,
      orderId: "ord-10432",
    },
    {
      id: 2,
      supplierId: "sup-balaji",
      householdId: "hh-priya",
      type: MONEY_TYPE.charge,
      amountPaise: 4500,
      sign: 1,
      mode: PAY_MODE.upi,
      orderId: "ord-10433",
    },
    {
      id: 3,
      supplierId: "sup-murugan",
      householdId: "hh-kavya",
      type: MONEY_TYPE.charge,
      amountPaise: 12000,
      sign: 1,
      mode: PAY_MODE.upi,
      orderId: "ord-10434",
    },
    {
      id: 4,
      supplierId: "sup-balaji",
      householdId: "hh-rahul",
      type: MONEY_TYPE.charge,
      amountPaise: 4500,
      sign: 1,
      mode: PAY_MODE.upi,
      orderId: "ord-10435",
    },
    {
      id: 5,
      supplierId: "sup-murugan",
      householdId: "hh-arun",
      type: MONEY_TYPE.charge,
      amountPaise: 8000,
      sign: 1,
      mode: PAY_MODE.upi,
      orderId: "ord-10436",
    }
  );
}

module.exports = { seedDemoData };
