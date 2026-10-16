const { parseBody } = require("../../http/parse-body");
const { sendJson } = require("../../http/send");

function registerAuthRoutes(router, { auth, guard, notifications }) {
  const verifiedPhones = new Map();
  const OTP_VERIFIED_TTL_MS = 10 * 60 * 1000;
  const phoneKey = (value) => String(value || "").replace(/[\s()-]/g, "");
  async function twilioVerify(path, phone, code) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const service = process.env.TWILIO_VERIFY_SERVICE_SID;
    if (!sid || !token || !service) {
      const err = new Error("SMS OTP is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_VERIFY_SERVICE_SID on the API server.");
      err.status = 503; err.code = "OTP_PROVIDER_NOT_CONFIGURED"; throw err;
    }
    const url = `https://verify.twilio.com/v2/Services/${service}${path ? "/VerificationCheck" : "/Verifications"}`;
    const body = new URLSearchParams(path ? { To: phone, Code: code } : { To: phone, Channel: "sms" });
    const response = await fetch(url, { method: "POST", headers: { Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" }, body });
    const data = await response.json();
    if (!response.ok) {
      const err = new Error(data.message || "Could not process OTP request."); err.status = response.status === 429 ? 429 : 400; err.code = "OTP_PROVIDER_ERROR"; throw err;
    }
    return data;
  }

  router.add("POST", "/v1/auth/otp/send", async (req, res) => {
    const body = await parseBody(req);
    const phone = phoneKey(body.phone);
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
      const err = new Error("Enter phone in international format, e.g. +919876543210"); err.status = 400; err.code = "INVALID_PHONE"; throw err;
    }
    await twilioVerify("", phone);
    sendJson(res, 200, { data: { sent: true, phone } });
  });

  router.add("POST", "/v1/auth/otp/verify", async (req, res) => {
    const body = await parseBody(req);
    const phone = phoneKey(body.phone);
    const code = String(body.code || "").trim();
    if (!/^\+[1-9]\d{7,14}$/.test(phone) || !/^\d{4,10}$/.test(code)) {
      const err = new Error("Enter a valid phone number and OTP."); err.status = 400; err.code = "INVALID_OTP"; throw err;
    }
    const result = await twilioVerify("/VerificationCheck", phone, code);
    if (result.status !== "approved") {
      const err = new Error("That OTP is incorrect or expired."); err.status = 400; err.code = "OTP_NOT_APPROVED"; throw err;
    }
    verifiedPhones.set(phone, Date.now() + OTP_VERIFIED_TTL_MS);
    sendJson(res, 200, { data: { verified: true } });
  });
  // Public: a new rider chooses which supplier they deliver for.
  router.add("GET", "/v1/auth/suppliers", (req, res) => {
    sendJson(res, 200, { data: auth.publicSuppliers() });
  });

  router.add("POST", "/v1/auth/register", async (req, res) => {
    const body = await parseBody(req, 2 * 1024 * 1024); // riders upload an ID photo
    const phone = phoneKey(body.phone);
    // Integration tests can simulate a completed OTP verification without contacting
    // Twilio. This header is deliberately ignored outside NODE_ENV=test.
    if (process.env.NODE_ENV === "test" && req.headers["x-test-otp-verified"] === "true") {
      verifiedPhones.set(phone, Date.now() + OTP_VERIFIED_TTL_MS);
    }
    const verifiedUntil = verifiedPhones.get(phone) || 0;
    if (verifiedUntil <= Date.now()) {
      verifiedPhones.delete(phone);
      const err = new Error("Verify your phone with the OTP before creating your account."); err.status = 403; err.code = "OTP_REQUIRED"; throw err;
    }
    const result = await auth.register(body);
    verifiedPhones.delete(phone);
    if (result.user.role === "RIDER") {
      notifications.notify({
        recipientType: "SUPPLIER",
        recipientId: result.user.supplierId,
        type: "rider.pending",
        title: "New delivery partner request",
        body: result.user.name + " uploaded an ID for your approval.",
        event: "rider.pending",
      });
    }
    sendJson(res, 201, { data: result });
  });

  router.add("POST", "/v1/auth/login", async (req, res) => {
    const body = await parseBody(req);
    const clientKey = req.socket && req.socket.remoteAddress;
    const result = await auth.login(body, clientKey);
    sendJson(res, 200, { data: result });
  });

  router.add(
    "POST",
    "/v1/auth/logout",
    guard(null, (req, res) => {
      auth.logout(req.token);
      sendJson(res, 200, { data: { loggedOut: true } });
    })
  );

  router.add(
    "GET",
    "/v1/auth/me",
    guard(null, (req, res) => {
      sendJson(res, 200, { data: { user: auth.profile(req.user) } });
    })
  );
}

module.exports = { registerAuthRoutes };
