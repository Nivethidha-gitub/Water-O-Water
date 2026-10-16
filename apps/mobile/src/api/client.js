import axios from "axios";
import { deleteItem, getItem, setItem } from "../utils/storage";

import {
  DEFAULT_SERVER,
  SERVER_KEY,
  TOKEN_KEY,
  normalizeServerUrl,
} from "../config/server";

let serverUrl = DEFAULT_SERVER;

export const getServerUrl = () => serverUrl;

const api = axios.create({
  baseURL: serverUrl + "/v1",
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

function applyServer(url) {
  serverUrl = normalizeServerUrl(url);
  api.defaults.baseURL = serverUrl + "/v1";
  return serverUrl;
}

/** Reads the address saved by "Server settings" (call once at start-up). */
export async function loadServerUrl() {
  try {
    const saved = await getItem(SERVER_KEY);
    if (saved) applyServer(saved);
  } catch (e) {
    /* keep the default */
  }
  return serverUrl;
}

export async function saveServerUrl(url) {
  const applied = applyServer(url);
  try {
    await setItem(SERVER_KEY, applied);
  } catch (e) {
    /* still applied for this session */
  }
  return applied;
}

export const getToken = () => getItem(TOKEN_KEY);
export const setToken = (token) => setItem(TOKEN_KEY, token);
export const clearToken = () => deleteItem(TOKEN_KEY);

api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// An expired / revoked session on any call signs the user out (not for the
// sign-in / sign-up calls themselves, where 401 just means "wrong password").
let unauthorizedHandler = null;
export const onUnauthorized = (handler) => {
  unauthorizedHandler = handler;
};

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = String(error.config?.url || "");
    const isAuthCall = url.includes("/auth/login") || url.includes("/auth/register");
    if (error.response?.status === 401 && !isAuthCall && unauthorizedHandler) {
      unauthorizedHandler();
    }
    return Promise.reject(error);
  }
);

/** A message that is safe to show the user, whatever went wrong. */
export function errorMessage(error, fallback = "Something went wrong. Please try again.") {
  const fromServer = error?.response?.data?.error?.message;
  if (fromServer) return fromServer;
  if (error?.code === "ECONNABORTED") {
    return "The server took too long to respond. Please try again.";
  }
  if (error?.message === "Network Error" || (!error?.response && error?.request)) {
    return `Can't reach the server at ${serverUrl}. Check your Wi-Fi and the server address in Server settings.`;
  }
  return fallback;
}

/** Which form field a server validation error belongs to, if any. */
export const errorField = (error) => error?.response?.data?.error?.details?.field || null;

export default api;
