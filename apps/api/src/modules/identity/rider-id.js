/*
 * Rider identity verification.
 *
 * A new rider must upload ONE government photo ID. Their supplier reviews it and
 * approves or rejects the rider; until then the rider cannot see or take deliveries.
 * Only the ID type, the last 4 characters of the number and the photo are kept
 * (never the full number), and only the rider and their own supplier can see them.
 */
const ID_TYPES = Object.freeze({
  aadhaar: "Aadhaar Card",
  driving_licence: "Driving Licence",
  voter_id: "Voter ID",
  pan: "PAN Card",
  passport: "Passport",
});

const MAX_ID_PHOTO_CHARS = 1600000; // about 1.2 MB of JPEG (the app resizes photos well below this)

function invalid(message, field) {
  const err = new Error(message);
  err.status = 400;
  err.code = "VALIDATION";
  err.field = field;
  return err;
}

/** Validates the upload and returns { idType, idLast4, photo } ready to store. */
function checkIdDocument(input) {
  const idType = String((input && input.idType) || "").trim();
  if (!ID_TYPES[idType]) throw invalid("Choose the type of ID you are uploading", "idType");
  const number = String((input && input.idNumber) || "").replace(/[\s-]/g, "");
  if (!/^[A-Za-z0-9]{6,20}$/.test(number)) throw invalid("Enter the ID number printed on your ID", "idNumber");
  const photo = String((input && input.idPhoto) || "").replace(/^data:image\/jpeg;base64,/, "");
  if (!photo) throw invalid("Upload a clear photo of your ID", "idPhoto");
  if (photo.length > MAX_ID_PHOTO_CHARS || !/^[A-Za-z0-9+/=\s]+$/.test(photo)) {
    throw invalid("The ID photo is too large or not a valid image", "idPhoto");
  }
  return { idType, idLast4: number.slice(-4).toUpperCase(), photo };
}

function saveIdDocument(db, userId, doc) {
  db.prepare(
    `INSERT OR REPLACE INTO rider_documents (user_id, id_type, id_last4, photo, submitted_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(userId, doc.idType, doc.idLast4, doc.photo, new Date().toISOString());
}

module.exports = { ID_TYPES, MAX_ID_PHOTO_CHARS, checkIdDocument, saveIdDocument };
