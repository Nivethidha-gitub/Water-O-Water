import api from "./client";

/** Profile, address, suppliers and orders in one call. */
export const getBootstrap = async () => (await api.get("/bootstrap")).data.data;

export const getSuppliers = async () => (await api.get("/suppliers")).data.data;

export const getProducts = async (supplierId) =>
  (await api.get("/products", { params: { supplierId } })).data.data;

export const getMyOrders = async () => (await api.get("/orders")).data.data;

/** One page of orders, newest first: { data, meta: { hasMore, nextCursor, total } }. */
export const getMyOrdersPage = async ({ limit = 20, before } = {}) =>
  (await api.get("/orders", { params: { limit, before } })).data;

export const getOrderDetails = async (id) => (await api.get(`/orders/${id}`)).data.data;

/** order = { supplierId, items: [{ productId, qty }], orderType, frequency, deliveryDays } */
export const placeOrder = async (order) => (await api.post("/orders", order)).data.data;

export const cancelOrder = async (id) => (await api.post(`/orders/${id}/cancel`)).data.data;

/** Create a provider-hosted UPI checkout link. Order is created only after the signed payment webhook confirms success. */
export const createUpiPaymentLink = async (order) => (await api.post("/payments/razorpay/link", order)).data.data;
export const getPaymentStatus = async (id) => (await api.get(`/payments/${id}`)).data.data;
export const getMyPayments = async () => (await api.get("/payments")).data.data;

// Saved addresses
export const getAddresses = async () => (await api.get("/addresses")).data.data;
export const addAddress = async (address) => (await api.post("/addresses", address)).data.data;
export const updateAddress = async (id, changes) => (await api.put(`/addresses/${id}`, changes)).data.data;
export const deleteAddress = async (id) => (await api.delete(`/addresses/${id}`)).data.data;
export const setDefaultAddress = async (id) => (await api.post(`/addresses/${id}/default`)).data.data;

// History: payments (cash and online, refunds) in pages, newest first
export const getPaymentHistoryPage = async ({ limit = 20, before } = {}) =>
  (await api.get("/history/payments", { params: { limit, before } })).data;

// After delivery
export const getOrderProof = async (id) => (await api.get(`/orders/${id}/proof`)).data.data;
export const rateOrder = async (id, rating, feedback) => (await api.post(`/orders/${id}/rating`, { rating, feedback })).data.data;
export const getOrderRefund = async (id) => (await api.get(`/orders/${id}/refund`)).data.data;
