/*
 * Saved delivery addresses (customer only).
 *
 *   GET    /v1/addresses              all of the household's addresses, default first
 *   POST   /v1/addresses              { label, line, instructions?, makeDefault? }
 *   PUT    /v1/addresses/:id          { label?, line?, instructions? }
 *   POST   /v1/addresses/:id/default  make this the default
 *   DELETE /v1/addresses/:id          the last remaining address cannot be deleted
 *
 * Orders keep their own copy of the address, so editing or deleting an address
 * never changes an order that was already placed.
 */
const { parseBody } = require("../../http/parse-body");
const { sendJson, sendError } = require("../../http/send");

const COLUMNS = "id, label, line, instructions, is_default AS isDefault";

function registerAddressRoutes(router, { db, guard }) {
  const householdOf = (req) =>
    db.prepare("SELECT household_id AS householdId FROM customers WHERE id = ?").get(req.user.customerId)?.householdId;

  function list(householdId) {
    const rows = db
      .prepare(`SELECT ${COLUMNS} FROM addresses WHERE household_id = ? ORDER BY is_default DESC, id`)
      .all(householdId);
    // A household with no explicit default (older data): the first address acts as the default.
    const hasDefault = rows.some((r) => r.isDefault === 1);
    return rows.map((r, i) => ({
      id: r.id,
      label: r.label || "Home",
      line: r.line,
      instructions: r.instructions || "",
      isDefault: hasDefault ? r.isDefault === 1 : i === 0,
    }));
  }

  function clean(body, partial) {
    const out = {};
    if (!partial || body.line !== undefined) {
      const line = String(body.line || "").trim().replace(/\s+/g, " ");
      if (line.length < 8 || line.length > 200) {
        const e = new Error("Enter the full address (8-200 characters)"); e.status = 400; e.field = "line"; throw e;
      }
      out.line = line;
    }
    if (!partial || body.label !== undefined) {
      out.label = String(body.label || "Home").trim().slice(0, 20) || "Home";
    }
    if (body.instructions !== undefined) {
      out.instructions = String(body.instructions || "").trim().slice(0, 200);
    }
    return out;
  }

  const wrap = (fn) =>
    guard(["CUSTOMER"], async (req, res) => {
      try { await fn(req, res); }
      catch (err) { sendError(res, err.status || 500, err.code || "VALIDATION", err.message, err.field); }
    });

  router.add("GET", "/v1/addresses", wrap((req, res) => {
    sendJson(res, 200, { data: list(householdOf(req)) });
  }));

  router.add("POST", "/v1/addresses", wrap(async (req, res) => {
    const householdId = householdOf(req);
    const body = await parseBody(req);
    const a = clean(body, false);
    const count = db.prepare("SELECT COUNT(*) AS n FROM addresses WHERE household_id = ?").get(householdId).n;
    if (count >= 10) return sendError(res, 409, "LIMIT_REACHED", "You can save up to 10 addresses", "line");
    const id = "addr-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const makeDefault = body.makeDefault === true || count === 0;
    db.transaction(() => {
      if (makeDefault) db.prepare("UPDATE addresses SET is_default = 0 WHERE household_id = ?").run(householdId);
      db.prepare("INSERT INTO addresses (id, household_id, line, delivery_pref, label, is_default, instructions) VALUES (?, ?, ?, 'door', ?, ?, ?)")
        .run(id, householdId, a.line, a.label, makeDefault ? 1 : 0, a.instructions || "");
    })();
    sendJson(res, 201, { data: list(householdId).find((x) => x.id === id) });
  }));

  router.add("PUT", "/v1/addresses/:id", wrap(async (req, res) => {
    const householdId = householdOf(req);
    const row = db.prepare("SELECT id FROM addresses WHERE id = ? AND household_id = ?").get(req.params.id, householdId);
    if (!row) return sendError(res, 404, "NOT_FOUND", "Address not found");
    const a = clean(await parseBody(req), true);
    const sets = Object.keys(a).map((k) => `${k === "line" ? "line" : k} = ?`);
    if (sets.length) db.prepare(`UPDATE addresses SET ${sets.join(", ")} WHERE id = ?`).run(...Object.values(a), row.id);
    sendJson(res, 200, { data: list(householdId).find((x) => x.id === row.id) });
  }));

  router.add("POST", "/v1/addresses/:id/default", wrap((req, res) => {
    const householdId = householdOf(req);
    const row = db.prepare("SELECT id FROM addresses WHERE id = ? AND household_id = ?").get(req.params.id, householdId);
    if (!row) return sendError(res, 404, "NOT_FOUND", "Address not found");
    db.transaction(() => {
      db.prepare("UPDATE addresses SET is_default = 0 WHERE household_id = ?").run(householdId);
      db.prepare("UPDATE addresses SET is_default = 1 WHERE id = ?").run(row.id);
    })();
    sendJson(res, 200, { data: list(householdId) });
  }));

  router.add("DELETE", "/v1/addresses/:id", wrap((req, res) => {
    const householdId = householdOf(req);
    const rows = list(householdId);
    const target = rows.find((r) => r.id === req.params.id);
    if (!target) return sendError(res, 404, "NOT_FOUND", "Address not found");
    if (rows.length === 1) return sendError(res, 409, "LAST_ADDRESS", "You need at least one saved address");
    db.transaction(() => {
      db.prepare("DELETE FROM addresses WHERE id = ?").run(target.id);
      if (target.isDefault) {
        const next = rows.find((r) => r.id !== target.id);
        db.prepare("UPDATE addresses SET is_default = 1 WHERE id = ?").run(next.id);
      }
    })();
    sendJson(res, 200, { data: list(householdId) });
  }));
}

module.exports = { registerAddressRoutes };
