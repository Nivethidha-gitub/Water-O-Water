import api from "./client";

// Orders (the server only returns this supplier's own orders)
export const getOrders = async () => (await api.get("/orders")).data.data;
export const getOrder = async (id) => (await api.get(`/orders/${id}`)).data.data;
export const acceptOrder = async (id) => (await api.post(`/orders/${id}/accept`, {})).data.data;
// The customer is notified straight away, with the reason if one is given.
export const rejectOrder = async (id, reason) => (await api.post(`/orders/${id}/decline`, { reason })).data.data;

// Delivery partners
export const getRiders = async () => (await api.get("/riders")).data.data;
export const assignRider = async (orderId, riderId) =>
  (await api.post(`/orders/${orderId}/assign-rider`, { riderId })).data.data;

// Supplier steps after accepting: Preparing, then Ready for pickup.
// Picking up, starting and completing the delivery belong to the assigned rider only (api/rider.js).
export const prepareOrder = async (id) => (await api.post(`/orders/${id}/prepare`, {})).data.data;
export const markOrderReady = async (id) => (await api.post(`/orders/${id}/ready`, {})).data.data;

// Catalog
export const getProducts = async () => (await api.get("/products")).data.data;
export const addProduct = async (product) => (await api.post("/products", product)).data.data;
export const deleteProduct = async (id) => (await api.delete(`/products/${id}`)).data.data;

// Service areas
export const getServiceAreas = async () => (await api.get("/service-areas")).data.data;
export const addServiceArea = async (name) =>
  (await api.post("/service-areas", { name })).data.data;

// Bulk update: one action for many orders. action = "accept" | "prepare" | "ready" | "assign-rider".
// The server handles each order on its own and reports every result, so a few
// failures never block the rest: { action, succeeded, failed, results: [...] }.
export const bulkUpdateOrders = async ({ action, orderIds, riderId }) =>
  (await api.post("/orders/bulk", { action, orderIds, riderId })).data.data;

// Rider approval: the supplier reviews the ID a new rider uploaded.
export const getRiderDocument = async (riderId) => (await api.get(`/riders/${riderId}/document`)).data.data;
export const approveRider = async (riderId) => (await api.post(`/riders/${riderId}/approve`)).data.data;
export const rejectRider = async (riderId, reason) => (await api.post(`/riders/${riderId}/reject`, { reason })).data.data;

// Stock: set a number, change by +/- delta, or null to stop tracking.  { stock, stockDelta, price, name }
export const updateProduct = async (id, changes) => (await api.patch(`/products/${id}`, changes)).data.data;
