const config = require("../config");

function corsHeaders() {
  const headers = { "X-Content-Type-Options": "nosniff" };
  if (config.corsOrigin) {
    headers["Access-Control-Allow-Origin"] = config.corsOrigin;
    headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, Idempotency-Key";
    headers["Access-Control-Allow-Methods"] = "GET, POST, DELETE, OPTIONS";
    headers["Vary"] = "Origin";
  }
  return headers;
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...corsHeaders(),
  });
  res.end(JSON.stringify(body));
}

function sendError(res, status, code, message, field) {
  sendJson(res, status, {
    error: { code, message, details: field ? { field } : {} },
  });
}

module.exports = { sendJson, sendError, corsHeaders };
