/*
 * Single API client for both roles. Every request carries the session token;
 * a 401 clears the session so the app returns to the sign-in page.
 */
const TOKEN_KEY = "wow.session";
const SERVER_KEY = "wow.server";

/*
 * Where the API lives. In the browser this is the same origin (Vite/Node
 * proxy). In the installed mobile app there is no same origin, so the server
 * address comes from the build (VITE_API_BASE_URL) or from the "Server"
 * setting on the sign-in screen.
 */
export function getServerUrl() {
  try {
    const saved = localStorage.getItem(SERVER_KEY);
    if (saved) return saved;
  } catch {
    /* storage unavailable */
  }
  return import.meta.env.VITE_API_BASE_URL || "";
}

export function setServerUrl(url) {
  const clean = String(url || "").trim().replace(/\/+$/, "");
  try {
    if (clean) localStorage.setItem(SERVER_KEY, clean);
    else localStorage.removeItem(SERVER_KEY);
  } catch {
    /* storage unavailable */
  }
}

export const apiBase = () => getServerUrl() + "/v1";

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details || {};
  }
}

let unauthorizedHandler = null;

export function onUnauthorized(handler) {
  unauthorizedHandler = handler;
}

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable: session lasts until reload */
  }
}

async function request(method, path, body, { auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (auth && token) headers.Authorization = "Bearer " + token;

  let response;
  try {
    response = await fetch(apiBase() + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "NETWORK", "Cannot reach the server. Check that the API is running.");
  }

  let json = null;
  try {
    json = await response.json();
  } catch {
    /* empty or non-JSON body */
  }

  if (!response.ok) {
    const error = json?.error || {};
    if (response.status === 401 && auth && token && unauthorizedHandler) {
      unauthorizedHandler();
    }
    throw new ApiError(
      response.status,
      error.code || "ERROR",
      error.message || "Request failed",
      error.details
    );
  }
  return json?.data;
}

// ---- Auth ---------------------------------------------------------------
export const register = (payload) => request("POST", "/auth/register", payload, { auth: false });
export const login = (payload) => request("POST", "/auth/login", payload, { auth: false });
export const logout = () => request("POST", "/auth/logout", {});
export const getMe = () => request("GET", "/auth/me");

// ---- Shared ---------------------------------------------------------------
export const getOrders = () => request("GET", "/orders");
export const getNotifications = () => request("GET", "/notifications");
export const markNotificationRead = (id) => request("POST", `/notifications/${id}/read`, {});
export const markAllNotificationsRead = () => request("POST", "/notifications/read-all", {});

// ---- Customer ---------------------------------------------------------------
export const getBootstrap = () => request("GET", "/bootstrap");
export const getSuppliers = () => request("GET", "/suppliers");
export const getSupplierProducts = (supplierId) =>
  request("GET", `/products?supplierId=${encodeURIComponent(supplierId)}`);
export const createOrder = (payload) => request("POST", "/orders", payload);
export const cancelOrder = (id) => request("POST", `/orders/${id}/cancel`, {});

// ---- Supplier ---------------------------------------------------------------
export const getProducts = () => request("GET", "/products");
export const createProduct = (product) => request("POST", "/products", product);
export const deleteProduct = (id) => request("DELETE", `/products/${id}`);
export const getServiceAreas = () => request("GET", "/service-areas");
export const createServiceArea = (name) => request("POST", "/service-areas", { name });
export const acceptOrder = (id, expectedVersion) =>
  request("POST", `/orders/${id}/accept`, { expectedVersion });
// Supplier steps after accepting. Picking up, starting and completing a delivery are the assigned rider's job.
export const prepareOrder = (id) => request("POST", `/orders/${id}/prepare`, {});
export const markOrderReady = (id) => request("POST", `/orders/${id}/ready`, {});

