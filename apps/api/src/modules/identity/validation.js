const { ApiError } = require("../../http/errors");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function fail(message, field) {
  const err = new ApiError(400, "VALIDATION", message);
  err.field = field;
  return err;
}

function normalizeEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  if (!email) return null;
  if (!EMAIL_RE.test(email) || email.length > 254) {
    throw fail("Enter a valid email address", "email");
  }
  return email;
}

function normalizePhone(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length < 10 || digits.length > 15) {
    throw fail("Enter a valid phone number (10-15 digits)", "phone");
  }
  // A bare 10 digit number is treated as an Indian mobile number.
  return digits.length === 10 ? "+91" + digits : "+" + digits;
}

function checkPassword(password) {
  const value = String(password || "");
  if (value.length < 8) {
    throw fail("Password must be at least 8 characters", "password");
  }
  if (value.length > 128) {
    throw fail("Password is too long", "password");
  }
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) {
    throw fail("Password must contain letters and numbers", "password");
  }
  return value;
}

function checkName(value, label, field) {
  const name = String(value || "").trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 80) {
    throw fail(label + " must be 2-80 characters", field);
  }
  return name;
}

/** Vehicle registration, e.g. "TN 37 DJ 0222". Optional; stored upper-case. */
function checkVehicle(value) {
  const text = String(value || "").trim().replace(/\s+/g, " ").toUpperCase();
  if (!text) return null;
  if (!/^[A-Z0-9][A-Z0-9 -]{2,15}$/.test(text)) {
    throw fail("Enter a valid vehicle number, e.g. TN 37 DJ 0222", "vehicleNo");
  }
  return text;
}

/** Login identifier may be an email or a phone number. */
function parseIdentifier(value) {
  const text = String(value || "").trim();
  if (!text) throw fail("Enter your email or phone number", "identifier");
  if (text.includes("@")) return { email: normalizeEmail(text), phone: null };
  return { email: null, phone: normalizePhone(text) };
}

module.exports = {
  fail,
  normalizeEmail,
  normalizePhone,
  checkPassword,
  checkName,
  checkVehicle,
  parseIdentifier,
};
