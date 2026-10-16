/*
 * Where the Water'O'Water API runs.
 *
 * Order of precedence:
 *   1. the address saved in the app ("Server settings" on the sign-in screen)
 *   2. EXPO_PUBLIC_API_URL  (e.g. in apps/mobile/.env)
 *   3. EXPO_PUBLIC_API_URL baked into the app build.
 *
 * Team/shared use: set EXPO_PUBLIC_API_URL to the one public HTTPS API URL
 * deployed by the project owner. Every downloaded copy must use that same URL
 * to share accounts, orders and live updates.
 * Local development: create apps/mobile/.env from .env.example and set the
 * value to your own computer's reachable LAN IP. A local API is NOT shared.
 */
export const DEFAULT_SERVER =
  process.env.EXPO_PUBLIC_API_URL || "https://water-o-water.onrender.com";

export const SERVER_KEY = "wow_server";
export const TOKEN_KEY = "wow_token";

/** "192.168.0.5:3001/v1/" -> "http://192.168.0.5:3001" */
export function normalizeServerUrl(value) {
  let text = String(value || "").trim().replace(/\/+$/, "").replace(/\/v1$/i, "");
  if (!text) return DEFAULT_SERVER;
  if (!/^https?:\/\//i.test(text)) text = "http://" + text;
  return text;
}
