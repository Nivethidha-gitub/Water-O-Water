import api from "./client";

/** { active: [...], history: [...] } - only deliveries assigned to this rider. */
export const getMyDeliveries = async () => (await api.get("/rider/orders")).data.data;

/** The rider's steps, in order: accept -> pickup -> start (out for delivery) -> deliver. */
export const acceptDelivery = async (id) => (await api.post(`/rider/orders/${id}/accept`)).data.data;
export const pickupDelivery = async (id) => (await api.post(`/rider/orders/${id}/pickup`)).data.data;
export const startDelivery = async (id) => (await api.post(`/rider/orders/${id}/start`)).data.data;

/** payload = { fullOut, emptyIn, paymentMode, amountCollectedPaise } */
export const completeDelivery = async (id, payload) =>
  (await api.post(`/rider/orders/${id}/deliver`, payload)).data.data;


/** Publishes the rider's current GPS position to all active deliveries. */
export const updateMyLocation = async ({ latitude, longitude, accuracy, speed, heading }) =>
  (await api.post("/rider/location", { latitude, longitude, accuracy, speed, heading })).data.data;

export const setDeliveryEta = async (id, eta) => (await api.post(`/rider/orders/${id}/eta`, { eta })).data.data;

/** Online / offline. Offline riders cannot be assigned new deliveries. */
export const getAvailability = async () => (await api.get("/rider/availability")).data.data;
export const setAvailability = async (online) => (await api.put("/rider/availability", { online })).data.data;

/** Delivery activity: { online, activeNow, today, last7Days, allTime } each { deliveries, orderValuePaise }. */
export const getRiderSummary = async () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0); // start of the rider's local day
  return (await api.get("/rider/summary", { params: { since: start.toISOString() } })).data.data;
};

/** Verification of the rider's ID by their supplier: { status: pending | approved | rejected, note, idTypeLabel, idLast4, supplierName }. */
export const getVerification = async () => (await api.get("/rider/verification")).data.data;
export const submitVerification = async ({ idType, idNumber, idPhoto }) =>
  (await api.post("/rider/verification", { idType, idNumber, idPhoto })).data.data;
