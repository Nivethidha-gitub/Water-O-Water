/*
 * Central configuration, read from environment variables (see .env.example).
 * Everything has a safe development default except secrets for production.
 */
const env = process.env;

const nodeEnv = env.NODE_ENV || "development";

module.exports = {
  nodeEnv,
  isProduction: nodeEnv === "production",
  // Render, Railway, and most cloud hosts provide PORT automatically.
  // Keep API_PORT as a local-development fallback.
  port: Number(env.PORT || env.API_PORT || 3001),
  host: env.API_HOST || "0.0.0.0",

  // SQLite file (or ":memory:"). Directory is created if missing.
  dbPath: env.WOW_DB_PATH || "",

  // Sessions & login protection
  sessionTtlHours: Number(env.SESSION_TTL_HOURS || 24 * 7),
  loginMaxAttempts: Number(env.LOGIN_MAX_ATTEMPTS || 8),
  loginWindowMin: Number(env.LOGIN_WINDOW_MIN || 15),

  // Real-time (Server-Sent Events)
  sseHeartbeatMs: Number(env.SSE_HEARTBEAT_MS || 25000),

  // Optional push provider hook (see notifications/channels/push.channel.js)
  pushProvider: env.PUSH_PROVIDER || "",

  // CORS: leave empty to allow only same-origin (the Vite proxy / reverse proxy
  // handles /v1). Set to the web origin if the API is hosted separately.
  corsOrigin: env.CORS_ORIGIN || (nodeEnv === "production" ? "" : "*"),

  // Demo accounts (customer@wow.test, murugan@wow.test ...). Off in production.
  seedDemoUsers: env.SEED_DEMO_USERS
    ? env.SEED_DEMO_USERS === "true"
    : nodeEnv !== "production",

  // WhatsApp webhook: open in development, requires this secret in production.
  whatsappSecret: env.WHATSAPP_WEBHOOK_SECRET || "",

  quiet: env.WOW_QUIET === "1",

  fallbackFeePaise: 500,
  acceptWindowMin: 20,
};
