/*
 * Notification tests: every notification must come from a real order/delivery event, reach exactly the
 * right person, and never be sent twice. Run with:  npm test
 * Uses an in-memory SQLite database and a real HTTP server on a random port.
 */
process.env.WOW_DB_PATH = ":memory:";
process.env.WOW_QUIET = "1";
process.env.SEED_DEMO_USERS = "true";
process.env.LOGIN_MAX_ATTEMPTS = "50";
process.env.NODE_ENV = "test";

const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");

const { createApp, handleRequest } = require("../src/app");

let server;
let base;
let app;

test.before(async () => {
  app = await createApp();
  server = http.createServer((req, res) => handleRequest(app, req, res));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = "http://127.0.0.1:" + server.address().port + "/v1";
});

test.after(() => {
  app.hub.closeAll();
  server.close();
});

async function call(method, path, { token, body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
      "x-test-otp-verified": "true",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  return { status: res.status, body: json, data: json.data, error: json.error };
}

async function login(email) {
  const r = await call("POST", "/auth/login", { body: { identifier: email, password: "Water@123" } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.data;
}

const inbox = async (who) => (await call("GET", "/notifications", { token: who.token })).data;
const forOrder = (data, id) => data.items.filter((n) => n.orderId === id);
const types = (list) => list.map((n) => n.type);

async function placeOrder(cust, supplierId = "sup-murugan", qty = 1) {
  const r = await call("POST", "/orders", { token: cust.token, body: { supplierId, items: [{ productId: "prod-20l", qty }] } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.data.id;
}

test("placing an order notifies the customer (confirmation) and only the chosen supplier", async () => {
  const cust = await login("customer@wow.test");
  const murugan = await login("murugan@wow.test");
  const balaji = await login("balaji@wow.test");
  const karthik = await login("rider@wow.test");

  const id = await placeOrder(cust);

  const c = forOrder(await inbox(cust), id);
  assert.equal(c.length, 1, "exactly one confirmation for the customer");
  assert.equal(c[0].type, "order.placed");
  assert.match(c[0].title, /placed/);

  const m = forOrder(await inbox(murugan), id);
  assert.deepEqual(types(m), ["order.created"]);

  assert.equal(forOrder(await inbox(balaji), id).length, 0, "other supplier gets nothing");
  assert.equal(forOrder(await inbox(karthik), id).length, 0, "riders get nothing before assignment");
});

test("full delivery flow: every step notifies the right people, once, and nobody else", async () => {
  const cust = await login("customer@wow.test");
  const other = await login("priya@wow.test");
  const murugan = await login("murugan@wow.test");
  const balaji = await login("balaji@wow.test");
  const karthik = await login("rider@wow.test");
  const dinesh = await login("dinesh@wow.test");

  const id = await placeOrder(cust, "sup-murugan", 2);
  assert.equal((await call("POST", `/orders/${id}/accept`, { token: murugan.token })).status, 200);

  let c = forOrder(await inbox(cust), id);
  assert.ok(c.some((n) => /accepted/.test(n.title)), "customer told the order was accepted");

  assert.equal((await call("POST", `/orders/${id}/prepare`, { token: murugan.token })).status, 200);
  assert.ok(forOrder(await inbox(cust), id).some((n) => /being prepared/.test(n.title)), "customer told it is being prepared");

  // Rider assignment: the rider and the customer are told
  assert.equal((await call("POST", `/orders/${id}/assign-rider`, { token: murugan.token, body: { riderId: "user-rider" } })).status, 200);
  const r1 = forOrder(await inbox(karthik), id);
  assert.deepEqual(types(r1), ["delivery.assigned"]);
  assert.ok(forOrder(await inbox(cust), id).some((n) => /Rider assigned/.test(n.title)));

  // Rider accepts: the supplier is told
  assert.equal((await call("POST", `/rider/orders/${id}/accept`, { token: karthik.token })).status, 200);
  assert.ok(forOrder(await inbox(murugan), id).some((n) => /accepted/.test(n.title) && /Karthik/.test(n.title)));

  // Ready for pickup: the customer and the assigned rider are told
  assert.equal((await call("POST", `/orders/${id}/ready`, { token: murugan.token })).status, 200);
  assert.ok(forOrder(await inbox(cust), id).some((n) => /is ready/.test(n.title)));
  assert.ok(forOrder(await inbox(karthik), id).some((n) => n.type === "delivery.ready"));

  // Pickup and out for delivery
  assert.equal((await call("POST", `/rider/orders/${id}/pickup`, { token: karthik.token })).status, 200);
  assert.ok(forOrder(await inbox(cust), id).some((n) => /picked up/.test(n.title)));
  assert.equal((await call("POST", `/rider/orders/${id}/start`, { token: karthik.token })).status, 200);
  assert.ok(forOrder(await inbox(cust), id).some((n) => /out for delivery/.test(n.title)));

  // Delivered
  const code = (await call("GET", "/orders/" + id, { token: cust.token })).data.deliveryCode;
  const done = await call("POST", `/rider/orders/${id}/deliver`, {
    token: karthik.token,
    body: { fullOut: 2, emptyIn: 2, paymentMode: "cash", amountCollectedPaise: 8000, deliveryCode: code },
  });
  assert.equal(done.status, 201, JSON.stringify(done.body));
  assert.ok(forOrder(await inbox(cust), id).some((n) => /delivered/.test(n.title)));
  assert.ok(forOrder(await inbox(murugan), id).some((n) => /delivered/.test(n.title)), "supplier told about delivery progress");

  // Each step produced exactly one customer notification: no duplicates anywhere
  c = forOrder(await inbox(cust), id);
  const titles = c.map((n) => n.title);
  assert.equal(new Set(titles).size, titles.length, "no duplicate customer notifications: " + titles.join(" | "));

  // Nobody else ever saw any of it
  for (const stranger of [other, balaji, dinesh]) {
    assert.equal(forOrder(await inbox(stranger), id).length, 0, "private order data reached someone it should not");
  }
});

test("a rejected order notifies the customer with the supplier's reason", async () => {
  const cust = await login("customer@wow.test");
  const murugan = await login("murugan@wow.test");
  const id = await placeOrder(cust);
  assert.equal((await call("POST", `/orders/${id}/decline`, { token: murugan.token, body: { reason: "Plant is closed today" } })).status, 200);
  const note = forOrder(await inbox(cust), id).find((n) => n.type === "order.declined");
  assert.ok(note);
  assert.match(note.body, /Plant is closed today/);
});

test("cancelling after a rider is assigned tells the rider and the supplier; reassigning tells the old rider", async () => {
  const cust = await login("customer@wow.test");
  const murugan = await login("murugan@wow.test");
  const karthik = await login("rider@wow.test");
  const suresh = await login("suresh@wow.test");
  const dinesh = await login("dinesh@wow.test");

  // Reassignment: Karthik is replaced by Suresh
  const a = await placeOrder(cust);
  await call("POST", `/orders/${a}/accept`, { token: murugan.token });
  await call("POST", `/orders/${a}/assign-rider`, { token: murugan.token, body: { riderId: "user-rider" } });
  const riders = (await call("GET", "/riders", { token: murugan.token })).data;
  const sureshId = riders.find((r) => r.name === "Suresh").id;
  assert.equal((await call("POST", `/orders/${a}/assign-rider`, { token: murugan.token, body: { riderId: sureshId } })).status, 200);

  const old = (await inbox(karthik)).items.filter((n) => n.type === "delivery.changed");
  assert.ok(old.length >= 1, "the rider who lost the delivery is told");
  assert.equal(old[0].orderId, null, "no link to an order the old rider can no longer open");
  assert.ok(forOrder(await inbox(suresh), a).some((n) => n.type === "delivery.assigned"), "the new rider is told");
  assert.equal(forOrder(await inbox(karthik), a).length, 1, "old rider only has the original assignment");

  // Cancellation: the currently assigned rider (Suresh) and the supplier are told; unrelated riders are not
  assert.equal((await call("POST", `/orders/${a}/cancel`, { token: cust.token })).status, 200);
  assert.ok(forOrder(await inbox(suresh), a).some((n) => n.type === "delivery.cancelled"), "assigned rider told it was cancelled");
  assert.ok(forOrder(await inbox(murugan), a).some((n) => /cancelled/.test(n.title)), "supplier told it was cancelled");
  assert.ok(forOrder(await inbox(cust), a).some((n) => /cancelled/.test(n.title)));
  assert.equal(forOrder(await inbox(dinesh), a).length, 0, "another supplier's rider hears nothing");
});

test("the same order change processed twice sends one notification (idempotent)", async () => {
  const cust = await login("customer@wow.test");
  const murugan = await login("murugan@wow.test");
  const karthik = await login("rider@wow.test");
  const id = await placeOrder(cust);
  await call("POST", `/orders/${id}/accept`, { token: murugan.token });
  await call("POST", `/orders/${id}/assign-rider`, { token: murugan.token, body: { riderId: "user-rider" } });

  // The HTTP layer refuses a repeat...
  assert.equal((await call("POST", `/orders/${id}/accept`, { token: murugan.token })).status, 409);

  // ...and even if the same internal event is replayed, no second notification is stored.
  const order = app.orders.getById(id);
  const before = forOrder(await inbox(karthik), id).length;
  app.orders.emit("updated", order, { actorType: "owner", riderAssigned: true });
  app.orders.emit("updated", order, { actorType: "owner", riderAssigned: true });
  assert.equal(forOrder(await inbox(karthik), id).length, before, "replayed event did not duplicate the rider notification");

  // The service itself: same key -> stored once; no key -> always stored
  const key = "test:" + id;
  const first = app.notifications.notify({ recipientType: "CUSTOMER", recipientId: "cust-ayesha", type: "x", title: "t", dedupeKey: key });
  const second = app.notifications.notify({ recipientType: "CUSTOMER", recipientId: "cust-ayesha", type: "x", title: "t", dedupeKey: key });
  assert.ok(first);
  assert.equal(second, null);
});

test("notifications are private: no cross-user reads, no marking someone else's, no anonymous access", async () => {
  const cust = await login("customer@wow.test");
  const priya = await login("priya@wow.test");
  const murugan = await login("murugan@wow.test");
  const id = await placeOrder(cust);

  const mine = forOrder(await inbox(cust), id)[0];
  assert.ok(mine);

  // Another customer cannot read it, or mark it read
  assert.equal(forOrder(await inbox(priya), id).length, 0);
  assert.equal((await call("POST", `/notifications/${mine.id}/read`, { token: priya.token })).status, 404);
  assert.equal((await call("POST", `/notifications/${mine.id}/read`, { token: murugan.token })).status, 404);

  // Anonymous access is refused for the list and the live stream
  assert.equal((await call("GET", "/notifications")).status, 401);
  assert.equal((await call("GET", "/events")).status, 401);

  // The owner can mark it read; the unread count follows
  const before = (await inbox(cust)).unreadCount;
  assert.equal((await call("POST", `/notifications/${mine.id}/read`, { token: cust.token })).status, 200);
  assert.equal((await inbox(cust)).unreadCount, before - 1);
  assert.equal((await call("POST", "/notifications/read-all", { token: cust.token })).status, 200);
  assert.equal((await inbox(cust)).unreadCount, 0);
});
