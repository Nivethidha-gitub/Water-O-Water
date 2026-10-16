/*
 * Proof of delivery.
 *
 * Every new order has a 4-digit delivery code that only the customer can see.
 * To complete a delivery the rider must either
 *   - enter that code (deliveryCode), or
 *   - take a photo of the delivered cans (proofPhoto, JPEG as base64) - used when the
 *     customer is not there to read out the code.
 * After 5 wrong codes on one order the code option is locked and a photo is required.
 * Orders placed before this feature have no code and are not asked for proof.
 */
const MAX_PHOTO_CHARS = 600000; // about 450 KB of JPEG
const MAX_WRONG_CODES = 5;
const wrongCodes = new Map(); // orderId -> count (resets when the server restarts)

function fail(status, code, message, field) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  if (field) err.field = field;
  return err;
}

function checkProof(order, body) {
  if (!order.deliveryCode) return { method: "none" };
  const given = String(body.deliveryCode || "").trim();
  const photo = typeof body.proofPhoto === "string" ? body.proofPhoto.replace(/^data:image\/jpeg;base64,/, "") : "";
  const locked = (wrongCodes.get(order.id) || 0) >= MAX_WRONG_CODES;

  if (given && !locked) {
    if (given === order.deliveryCode) {
      wrongCodes.delete(order.id);
      return { method: "code", note: String(body.proofNote || "").trim().slice(0, 200) };
    }
    const used = (wrongCodes.get(order.id) || 0) + 1;
    wrongCodes.set(order.id, used);
    if (!photo) {
      const left = MAX_WRONG_CODES - used;
      throw fail(400, "WRONG_DELIVERY_CODE", left > 0 ? `That code is not right. ${left} ${left === 1 ? "try" : "tries"} left.` : "Too many wrong codes. Take a proof photo instead.", "deliveryCode");
    }
  }
  if (photo) {
    if (photo.length > MAX_PHOTO_CHARS || !/^[A-Za-z0-9+/=\s]+$/.test(photo)) {
      throw fail(400, "INVALID_PHOTO", "The proof photo is too large or not a valid image", "proofPhoto");
    }
    return { method: "photo", photo, note: String(body.proofNote || "").trim().slice(0, 200) };
  }
  if (given && locked) throw fail(429, "CODE_LOCKED", "Too many wrong codes. Take a proof photo instead.", "deliveryCode");
  throw fail(400, "PROOF_REQUIRED", "Enter the customer's delivery code or take a proof photo", "deliveryCode");
}

function saveProof(db, order, proof, riderUserId) {
  if (proof.method === "none") return;
  db.prepare(
    `INSERT OR REPLACE INTO delivery_proofs (order_id, method, photo, note, rider_user_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(order.id, proof.method, proof.photo || null, proof.note || null, riderUserId, new Date().toISOString());
}

module.exports = { checkProof, saveProof, MAX_PHOTO_CHARS };
