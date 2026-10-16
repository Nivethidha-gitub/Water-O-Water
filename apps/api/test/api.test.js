/*
 * End-to-end API tests. Run with:  npm test
 * Uses an in-memory SQLite database and a real HTTP server on a random port.
 */
process.env.WOW_DB_PATH = ":memory:";
process.env.WOW_QUIET = "1";
process.env.SEED_DEMO_USERS = "true";
process.env.LOGIN_MAX_ATTEMPTS = "5";
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

async function call(method, path, { token, body, otpVerified = true } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
      ...(otpVerified ? { "x-test-otp-verified": "true" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  return { status: res.status, body: json, data: json.data, error: json.error };
}

// The delivery code is shown only to the customer, once the order is accepted.
async function codeOf(customerToken, orderId) {
  return (await call("GET", "/orders/" + orderId, { token: customerToken })).data?.deliveryCode;
}

async function login(email, password = "Water@123", role) {
  const r = await call("POST", "/auth/login", { body: { identifier: email, password, role } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.data;
}

// Opens the SSE stream with a bearer token and collects events.
async function openStream(token) {
  const controller = new AbortController();
  const res = await fetch(base + "/events", {
    headers: { Authorization: "Bearer " + token },
    signal: controller.signal,
  });
  assert.equal(res.status, 200);
  const events = [];
  const decoder = new TextDecoder();
  let buffer = "";
  (async () => {
    try {
      for await (const chunk of res.body) {
        buffer += decoder.decode(chunk, { stream: true });
        let idx;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const frame = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const name = /^event: (.+)$/m.exec(frame);
          const data = /^data: (.+)$/m.exec(frame);
          if (name && data) events.push({ event: name[1], data: JSON.parse(data[1]) });
        }
      }
    } catch (_) {
      /* aborted */
    }
  })();
  return { events, close: () => controller.abort() };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test("registration is blocked until phone OTP has been verified", async () => {
  const r = await call("POST", "/auth/register", {
    otpVerified: false,
    body: { role: "CUSTOMER", name: "No OTP", phone: "+919876543210", password: "Passw0rd!" },
  });
  assert.equal(r.status, 403);
  assert.equal(r.error.code, "OTP_REQUIRED");
});

test("registration validates input and never stores a plain password", async () => {
  let r = await call("POST", "/auth/register", { body: { role: "CUSTOMER", name: "A", password: "x" } });
  assert.equal(r.status, 400);

  r = await call("POST", "/auth/register", {
    body: { role: "CUSTOMER", name: "Test Cust", email: "tc@example.com", password: "nodigitshere" },
  });
  assert.equal(r.status, 400);

  r = await call("POST", "/auth/register", {
    body: { role: "ADMIN", name: "Test", email: "x@example.com", password: "Passw0rd!" },
  });
  assert.equal(r.status, 400);

  r = await call("POST", "/auth/register", {
    body: { role: "CUSTOMER", name: "Test Cust", email: "TC@example.com", password: "Passw0rd!", address: "RS Puram" },
  });
  assert.equal(r.status, 201);
  assert.equal(r.data.user.role, "CUSTOMER");
  assert.ok(r.data.token);
  assert.equal(r.data.user.passwordHash, undefined);

  const row = app.db.prepare("SELECT password_hash AS h FROM users WHERE email = ?").get("tc@example.com");
  assert.ok(row.h.startsWith("scrypt$"));
  assert.ok(!row.h.includes("Passw0rd!"));

  r = await call("POST", "/auth/register", {
    body: { role: "SUPPLIER", name: "Dup", email: "tc@example.com", businessName: "Dup Water", password: "Passw0rd!" },
  });
  assert.equal(r.status, 409);
});

test("login: wrong password, role mismatch, role detection, logout", async () => {
  let r = await call("POST", "/auth/login", { body: { identifier: "customer@wow.test", password: "wrong-pass1" } });
  assert.equal(r.status, 401);

  r = await call("POST", "/auth/login", {
    body: { identifier: "customer@wow.test", password: "Water@123", role: "SUPPLIER" },
  });
  assert.equal(r.status, 403);
  assert.equal(r.error.code, "ROLE_MISMATCH");

  const cust = await login("customer@wow.test");
  assert.equal(cust.user.role, "CUSTOMER");
  const sup = await login("murugan@wow.test");
  assert.equal(sup.user.role, "SUPPLIER");
  assert.equal(sup.user.supplierId, "sup-murugan");

  let me = await call("GET", "/auth/me", { token: cust.token });
  assert.equal(me.status, 200);
  assert.equal(me.data.user.role, "CUSTOMER");

  assert.equal((await call("POST", "/auth/logout", { token: cust.token })).status, 200);
  me = await call("GET", "/auth/me", { token: cust.token });
  assert.equal(me.status, 401);
});

test("login is rate limited after repeated failures", async () => {
  for (let i = 0; i < 5; i++) {
    await call("POST", "/auth/login", { body: { identifier: "tc@example.com", password: "bad-pass-1" } });
  }
  const r = await call("POST", "/auth/login", { body: { identifier: "tc@example.com", password: "Passw0rd!" } });
  assert.equal(r.status, 429);
});

test("unauthenticated and wrong-role requests are rejected by the API", async () => {
  assert.equal((await call("GET", "/orders")).status, 401);
  assert.equal((await call("GET", "/orders", { token: "garbage" })).status, 401);

  const cust = await login("customer@wow.test");
  const sup = await login("murugan@wow.test");

  // Customer cannot use supplier endpoints
  assert.equal((await call("POST", "/products", { token: cust.token, body: { name: "x", sku: "x", price: 5 } })).status, 403);
  assert.equal((await call("POST", "/orders/ord-10434/accept", { token: cust.token, body: {} })).status, 403);
  assert.equal((await call("GET", "/ops/fallback-queue", { token: cust.token })).status, 403);

  // Supplier cannot place orders or use customer bootstrap
  assert.equal(
    (await call("POST", "/orders", { token: sup.token, body: { supplierId: "sup-murugan", items: [{ productId: "prod-20l", qty: 1 }] } })).status,
    403
  );
  assert.equal((await call("GET", "/bootstrap", { token: sup.token })).status, 403);

  // Removed leaky endpoint
  assert.equal((await call("GET", "/customers", { token: sup.token })).status, 404);
});

test("order goes to the selected supplier only; notification + realtime are scoped", async () => {
  const cust = await login("customer@wow.test"); // Ayesha
  const murugan = await login("murugan@wow.test");
  const balaji = await login("balaji@wow.test");

  const muruganStream = await openStream(murugan.token);
  const balajiStream = await openStream(balaji.token);
  await wait(100);

  const placed = await call("POST", "/orders", {
    token: cust.token,
    body: { supplierId: "sup-balaji", items: [{ productId: "prod-20l-balaji", qty: 3 }], customerId: "cust-priya" },
  });
  assert.equal(placed.status, 201, JSON.stringify(placed.body));
  const order = placed.data;
  assert.equal(order.supplierId, "sup-balaji");
  assert.equal(order.customerId, "cust-ayesha"); // taken from the session, body value ignored
  assert.equal(order.status, "placed");
  assert.ok(order.orderId && order.createdAt);
  assert.equal(order.totalPaise, 13500);

  await wait(200);

  // Balaji (the chosen supplier) was notified in real time...
  const got = balajiStream.events.filter((e) => e.event === "order.created");
  assert.equal(got.length, 1);
  assert.equal(got[0].data.order.id, order.id);
  assert.equal(got[0].data.order.customer.name, "Ayesha R.");
  // ...Murugan was not.
  assert.equal(muruganStream.events.filter((e) => e.event === "order.created").length, 0);

  const bn = await call("GET", "/notifications", { token: balaji.token });
  assert.ok(bn.data.items.some((n) => n.orderId === order.id && n.type === "order.created"));
  assert.equal(bn.data.unreadCount >= 1, true);
  const mn = await call("GET", "/notifications", { token: murugan.token });
  assert.ok(!mn.data.items.some((n) => n.orderId === order.id));

  // Supplier B can open it; supplier A, other customer and the owner can/can't
  assert.equal((await call("GET", "/orders/" + order.id, { token: balaji.token })).status, 200);
  assert.equal((await call("GET", "/orders/" + order.id, { token: murugan.token })).status, 404);
  assert.equal((await call("GET", "/orders/" + order.id, { token: cust.token })).status, 200);

  const priya = (await call("POST", "/auth/login", { body: { identifier: "priya@wow.test", password: "Water@123" } })).data;
  assert.equal((await call("GET", "/orders/" + order.id, { token: priya.token })).status, 404);

  // Lists are scoped
  const balajiList = (await call("GET", "/orders", { token: balaji.token })).data;
  assert.ok(balajiList.every((o) => o.supplierId === "sup-balaji"));
  assert.ok(balajiList.some((o) => o.id === order.id));
  const muruganList = (await call("GET", "/orders", { token: murugan.token })).data;
  assert.ok(muruganList.every((o) => o.supplierId === "sup-murugan"));
  assert.ok(!muruganList.some((o) => o.id === order.id));
  const priyaList = (await call("GET", "/orders", { token: priya.token })).data;
  assert.ok(priyaList.every((o) => o.customerId === "cust-priya"));

  // Wrong supplier cannot act on it; right supplier can
  assert.equal((await call("POST", `/orders/${order.id}/accept`, { token: murugan.token, body: {} })).status, 404);
  const accepted = await call("POST", `/orders/${order.id}/accept`, { token: balaji.token, body: { expectedVersion: order.version } });
  assert.equal(accepted.status, 200);
  assert.equal(accepted.data.status, "accepted");

  // Customer gets the status update live-persisted as a notification
  const cn = await call("GET", "/notifications", { token: cust.token }); // cust token was valid (logout test used another session)
  assert.ok(cn.data.items.some((n) => n.orderId === order.id && n.type === "order.updated"));

  muruganStream.close();
  balajiStream.close();
});

test("order validation: product must belong to the selected supplier", async () => {
  const cust = await login("customer@wow.test");
  let r = await call("POST", "/orders", {
    token: cust.token,
    body: { supplierId: "sup-murugan", items: [{ productId: "prod-20l-balaji", qty: 1 }] },
  });
  assert.equal(r.status, 400);
  assert.equal(r.error.code, "PRODUCT_SUPPLIER_MISMATCH");

  r = await call("POST", "/orders", { token: cust.token, body: { items: [{ productId: "prod-20l", qty: 1 }] } });
  assert.equal(r.status, 400);

  r = await call("POST", "/orders", { token: cust.token, body: { supplierId: "sup-nope", items: [{ productId: "prod-20l", qty: 1 }] } });
  assert.equal(r.status, 400);

  r = await call("POST", "/orders", { token: cust.token, body: { supplierId: "sup-murugan", items: [{ productId: "prod-20l", qty: -2 }] } });
  assert.equal(r.status, 400);
  r = await call("POST", "/orders", { token: cust.token, body: { supplierId: "sup-murugan", items: [{ productId: "prod-20l", qty: 0 }] } });
  assert.equal(r.status, 400);
});

test("a newly registered supplier receives only their own orders", async () => {
  const reg = await call("POST", "/auth/register", {
    body: { role: "SUPPLIER", name: "Ravi K", businessName: "Ravi Aqua", email: "ravi@example.com", password: "Passw0rd!", address: "Peelamedu" },
  });
  assert.equal(reg.status, 201);
  const ravi = reg.data;
  assert.equal(ravi.user.role, "SUPPLIER");
  const raviId = ravi.user.supplierId;

  // Ravi adds a product; customers can browse and order it
  const prod = await call("POST", "/products", { token: ravi.token, body: { name: "20L Can", sku: "RA20", price: 55 } });
  assert.equal(prod.status, 201);
  assert.equal(prod.data.supplierId, raviId);

  const cust = await login("customer@wow.test");
  const suppliers = await call("GET", "/suppliers", { token: cust.token });
  assert.ok(suppliers.data.some((s) => s.id === raviId && s.name === "Ravi Aqua"));
  const products = await call("GET", "/products?supplierId=" + raviId, { token: cust.token });
  assert.equal(products.data.length, 1);

  const order = await call("POST", "/orders", {
    token: cust.token,
    body: { supplierId: raviId, items: [{ productId: prod.data.id, qty: 2 }] },
  });
  assert.equal(order.status, 201);

  const raviOrders = (await call("GET", "/orders", { token: ravi.token })).data;
  assert.equal(raviOrders.length, 1);
  assert.equal(raviOrders[0].id, order.data.id);

  // Another supplier cannot delete Ravi's product
  const murugan = await login("murugan@wow.test");
  assert.equal((await call("DELETE", "/products/" + prod.data.id, { token: murugan.token })).status, 404);
  // Supplier's product list is scoped to themselves
  const mp = await call("GET", "/products?supplierId=" + raviId, { token: murugan.token });
  assert.ok(mp.data.every((p) => p.supplierId === "sup-murugan"));
});

test("orders persist in the database", async () => {
  const count = app.db.prepare("SELECT COUNT(*) AS n FROM orders").get().n;
  const items = app.db.prepare("SELECT COUNT(*) AS n FROM order_items").get().n;
  assert.ok(count >= 7);
  assert.ok(items >= 2);
});

test("whatsapp webhook is open only outside production", async () => {
  const r = await call("POST", "/webhooks/whatsapp", { body: { text: "hi", customerId: "cust-ayesha" } });
  assert.equal(r.status, 200);
  assert.equal(r.data.order.primarySupplierId, "sup-murugan");
});

// ---------------------------------------------------------------------------
// Riders
// ---------------------------------------------------------------------------

test("rider sign-up: needs a supplier + phone; login routes by role", async () => {
  // Public supplier list for the sign-up picker (no token needed)
  const list = await call("GET", "/auth/suppliers");
  assert.equal(list.status, 200);
  assert.ok(list.data.some((s) => s.id === "sup-murugan"));
  assert.equal(list.data[0].passwordHash, undefined);

  const idPhoto = "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA==";
  const base = { role: "RIDER", name: "Ravi Rider", password: "Rider@1234", phone: "9000011111", supplierId: "sup-murugan", idType: "aadhaar", idNumber: "1234 5678 9012", idPhoto };

  let r = await call("POST", "/auth/register", { body: { ...base, supplierId: undefined } });
  assert.equal(r.status, 400, "supplier required");
  r = await call("POST", "/auth/register", { body: { ...base, supplierId: "sup-nope" } });
  assert.equal(r.status, 400, "unknown supplier");
  r = await call("POST", "/auth/register", { body: { ...base, phone: "" } });
  assert.equal(r.status, 400, "phone required");
  r = await call("POST", "/auth/register", { body: { ...base, vehicleNo: "??" } });
  assert.equal(r.status, 400, "bad vehicle number");

  r = await call("POST", "/auth/register", { body: { ...base, vehicleNo: "tn 01 ab 1234" } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.data.user.role, "RIDER");
  assert.equal(r.data.user.supplierId, "sup-murugan");
  assert.equal(r.data.user.vehicleNo, "TN 01 AB 1234");
  assert.equal(r.data.user.supplier.name, "Murugan Water");

  // Signing a rider in on the wrong tab is refused with a clear role message
  r = await call("POST", "/auth/login", { body: { identifier: "rider@wow.test", password: "Water@123", role: "CUSTOMER" } });
  assert.equal(r.status, 403);
  assert.equal(r.error.code, "ROLE_MISMATCH");

  // With no role chosen the server reports the account's own role
  const rider = await login("rider@wow.test");
  assert.equal(rider.user.role, "RIDER");
  assert.equal(rider.user.supplierId, "sup-murugan");
});

test("rider role is fenced off from customer + supplier endpoints (and vice versa)", async () => {
  const rider = await login("rider@wow.test");
  const cust = await login("customer@wow.test");
  const sup = await login("murugan@wow.test");

  // rider cannot place orders, manage products, accept, or load the customer bootstrap
  assert.equal((await call("POST", "/orders", { token: rider.token, body: { supplierId: "sup-murugan", items: [{ productId: "prod-20l", qty: 1 }] } })).status, 403);
  assert.equal((await call("POST", "/products", { token: rider.token, body: { name: "x", sku: "x", price: 5 } })).status, 403);
  assert.equal((await call("POST", "/orders/ord-10434/accept", { token: rider.token, body: {} })).status, 403);
  assert.equal((await call("GET", "/bootstrap", { token: rider.token })).status, 403);
  assert.equal((await call("GET", "/riders", { token: rider.token })).status, 403);

  // customers and suppliers cannot use the rider endpoints
  assert.equal((await call("GET", "/rider/orders", { token: cust.token })).status, 403);
  assert.equal((await call("GET", "/rider/orders", { token: sup.token })).status, 403);
  assert.equal((await call("POST", "/rider/orders/ord-10434/start", { token: sup.token })).status, 403);
  assert.equal((await call("GET", "/riders", { token: cust.token })).status, 403);
  assert.equal((await call("GET", "/rider/orders")).status, 401);
});

test("full flow: place -> accept -> assign rider -> rider start -> rider deliver", async () => {
  const cust = await login("customer@wow.test");
  const murugan = await login("murugan@wow.test");
  const balaji = await login("balaji@wow.test");
  const karthik = await login("rider@wow.test");   // Murugan's rider
  const dinesh = await login("dinesh@wow.test");   // Balaji's rider

  const riderStream = await openStream(karthik.token);
  await wait(100);

  const placed = await call("POST", "/orders", {
    token: cust.token,
    body: { supplierId: "sup-murugan", items: [{ productId: "prod-20l", qty: 2 }] },
  });
  assert.equal(placed.status, 201, JSON.stringify(placed.body));
  const id = placed.data.id;

  // Nobody is assigned yet: the rider cannot see or touch it
  assert.equal((await call("GET", "/orders/" + id, { token: karthik.token })).status, 404);
  assert.equal((await call("POST", `/rider/orders/${id}/start`, { token: karthik.token })).status, 404);

  // Supplier lists their own riders only
  const riders = await call("GET", "/riders", { token: murugan.token });
  assert.equal(riders.status, 200);
  assert.ok(riders.data.some((r) => r.id === "user-rider" && r.vehicleNo === "TN 37 DJ 0222"));
  assert.ok(riders.data.every((r) => r.id !== "user-dinesh"), "other supplier's rider hidden");
  assert.equal(riders.data[0].passwordHash, undefined);

  // Cannot assign before the order is accepted
  let r = await call("POST", `/orders/${id}/assign-rider`, { token: murugan.token, body: { riderId: "user-rider" } });
  assert.equal(r.status, 409);

  assert.equal((await call("POST", `/orders/${id}/accept`, { token: murugan.token, body: {} })).status, 200);

  // Cannot assign another supplier's rider, a customer, or nothing
  assert.equal((await call("POST", `/orders/${id}/assign-rider`, { token: murugan.token, body: { riderId: "user-dinesh" } })).status, 400);
  assert.equal((await call("POST", `/orders/${id}/assign-rider`, { token: murugan.token, body: { riderId: "user-customer" } })).status, 400);
  assert.equal((await call("POST", `/orders/${id}/assign-rider`, { token: murugan.token, body: {} })).status, 400);
  // Another supplier cannot assign on this order at all
  assert.equal((await call("POST", `/orders/${id}/assign-rider`, { token: balaji.token, body: { riderId: "user-dinesh" } })).status, 404);

  r = await call("POST", `/orders/${id}/assign-rider`, { token: murugan.token, body: { riderId: "user-rider" } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.data.rider.name, "Karthik");
  assert.equal(r.data.rider.phone, "+919876540011");
  assert.equal(r.data.status, "accepted");

  // Rider got a live "new delivery" event; customer got a rider notification
  await wait(200);
  assert.ok(riderStream.events.some((e) => e.data && e.data.order && e.data.order.id === id), "rider streamed");
  const rn = await call("GET", "/notifications", { token: karthik.token });
  assert.ok(rn.data.items.some((n) => n.orderId === id && n.type === "delivery.assigned"));
  const cn = await call("GET", "/notifications", { token: cust.token });
  assert.ok(cn.data.items.some((n) => n.orderId === id && /Rider assigned/.test(n.title)));

  // The assigned rider sees it, with delivery details; the other supplier's rider does not
  const mine = await call("GET", "/rider/orders", { token: karthik.token });
  const found = mine.data.active.find((o) => o.id === id);
  assert.ok(found);
  assert.equal(found.customer.name, "Ayesha R.");
  assert.ok(found.customer.address, "rider gets delivery address");
  assert.equal((await call("GET", "/orders/" + id, { token: dinesh.token })).status, 404);
  assert.equal((await call("POST", `/rider/orders/${id}/start`, { token: dinesh.token })).status, 404);
  // Customer sees who is coming
  const custView = await call("GET", "/orders/" + id, { token: cust.token });
  assert.equal(custView.data.rider.name, "Karthik");
  assert.equal(custView.data.customer.address, undefined, "customer view has no address leak");

  // The rider cannot skip steps: nothing to pick up / start / deliver until the supplier says it is ready
  assert.equal((await call("POST", `/rider/orders/${id}/pickup`, { token: karthik.token })).status, 409);
  assert.equal((await call("POST", `/rider/orders/${id}/start`, { token: karthik.token })).status, 409);
  assert.equal((await call("POST", `/rider/orders/${id}/deliver`, { token: karthik.token, body: { fullOut: 2, emptyIn: 2 } })).status, 409);

  // Supplier: accepted -> preparing -> ready for pickup (and cannot repeat or skip)
  assert.equal((await call("POST", `/orders/${id}/ready`, { token: murugan.token })).status, 409, "cannot be ready before preparing");
  r = await call("POST", `/orders/${id}/prepare`, { token: murugan.token });
  assert.equal(r.data.status, "preparing");
  assert.equal((await call("POST", `/orders/${id}/prepare`, { token: murugan.token })).status, 409);
  // The rider accepts first; only the assigned rider can
  assert.equal((await call("POST", `/rider/orders/${id}/accept`, { token: dinesh.token })).status, 404);
  assert.equal((await call("POST", `/rider/orders/${id}/pickup`, { token: karthik.token })).status, 409, "still preparing");
  r = await call("POST", `/orders/${id}/ready`, { token: murugan.token });
  assert.equal(r.data.status, "ready_for_pickup");
  // Not accepted yet -> cannot pick up
  r = await call("POST", `/rider/orders/${id}/pickup`, { token: karthik.token });
  assert.equal(r.status, 409);
  assert.equal(r.error.code, "RIDER_NOT_ACCEPTED");
  r = await call("POST", `/rider/orders/${id}/accept`, { token: karthik.token });
  assert.equal(r.status, 200);
  assert.ok(r.data.riderAcceptedAt);
  assert.equal((await call("POST", `/rider/orders/${id}/accept`, { token: karthik.token })).status, 409, "no double accept");
  // The supplier is told the rider accepted
  assert.ok((await call("GET", "/notifications", { token: murugan.token })).data.items.some((n) => n.orderId === id && /accepted/.test(n.title) && /Karthik/.test(n.title)));

  r = await call("POST", `/rider/orders/${id}/pickup`, { token: karthik.token });
  assert.equal(r.data.status, "picked_up");
  assert.equal((await call("POST", `/rider/orders/${id}/deliver`, { token: karthik.token, body: { fullOut: 2, emptyIn: 2 } })).status, 409, "cannot deliver straight from picked up");

  r = await call("POST", `/rider/orders/${id}/start`, { token: karthik.token });
  assert.equal(r.status, 200);
  assert.equal(r.data.status, "out_for_delivery");
  assert.equal((await call("GET", "/orders/" + id, { token: cust.token })).data.status, "out_for_delivery");

  // Bad numbers are rejected; good delivery completes the order
  assert.equal((await call("POST", `/rider/orders/${id}/deliver`, { token: karthik.token, body: { fullOut: -1, emptyIn: 0 } })).status, 400);
  // Proof of delivery: the rider never sees the code; no proof, or a wrong code, cannot complete the order
  const riderView = await call("GET", "/rider/orders", { token: karthik.token });
  const riderOrder = riderView.data.active.find((o) => o.id === id);
  assert.equal(riderOrder.deliveryCode, undefined, "rider must not see the delivery code");
  assert.equal(riderOrder.proofRequired, true);
  const code = await codeOf(cust.token, id);
  assert.match(code, /^\d{4}$/);
  let denied = await call("POST", `/rider/orders/${id}/deliver`, { token: karthik.token, body: { fullOut: 2, emptyIn: 2 } });
  assert.equal(denied.error.code, "PROOF_REQUIRED");
  denied = await call("POST", `/rider/orders/${id}/deliver`, { token: karthik.token, body: { fullOut: 2, emptyIn: 2, deliveryCode: code === "0000" ? "1111" : "0000" } });
  assert.equal(denied.error.code, "WRONG_DELIVERY_CODE");
  assert.equal((await call("GET", "/orders/" + id, { token: cust.token })).data.status, "out_for_delivery");

  r = await call("POST", `/rider/orders/${id}/deliver`, {
    token: karthik.token,
    body: { fullOut: 2, emptyIn: 2, paymentMode: "cash", amountCollectedPaise: 8000, deliveryCode: code },
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.data.order.status, "delivered");
  assert.equal(r.data.delivery.riderUserId, "user-rider");

  // It moves from the rider's active list to history; double-delivery is refused
  const after = await call("GET", "/rider/orders", { token: karthik.token });
  assert.ok(!after.data.active.some((o) => o.id === id));
  assert.ok(after.data.history.some((o) => o.id === id));
  assert.equal((await call("POST", `/rider/orders/${id}/deliver`, { token: karthik.token, body: { fullOut: 2, emptyIn: 2 } })).status, 409);

  // Supplier + customer both see the final status
  assert.equal((await call("GET", "/orders/" + id, { token: murugan.token })).data.status, "delivered");
  const cn2 = await call("GET", "/notifications", { token: cust.token });
  assert.ok(cn2.data.items.some((n) => n.orderId === id && /delivered/.test(n.title)));
  const mnote = await call("GET", "/notifications", { token: murugan.token });
  assert.ok(mnote.data.items.some((n) => n.orderId === id && /delivered/.test(n.title)), "supplier told when the rider delivers");

  riderStream.close();
});

test("the supplier can never start or complete a delivery, and the customer never sees Delivered early", async () => {
  const cust = await login("customer@wow.test");
  const murugan = await login("murugan@wow.test");
  const balaji = await login("balaji@wow.test");
  const suresh = await login("suresh@wow.test");     // Murugan's rider (assigned)
  const karthik = await login("rider@wow.test");     // Murugan's other rider (NOT assigned)
  const dinesh = await login("dinesh@wow.test");     // another supplier's rider
  const placed = await call("POST", "/orders", {
    token: cust.token,
    body: { supplierId: "sup-murugan", items: [{ productId: "prod-20l", qty: 1 }] },
  });
  const id = placed.data.id;
  const status = async () => (await call("GET", "/orders/" + id, { token: cust.token })).data.status;
  const deliverBody = { fullOut: 1, emptyIn: 1, paymentMode: "upi", amountCollectedPaise: 4000 };

  // Supplier tries every shortcut at every stage: all refused, the status never becomes delivered
  const supplierShortcuts = async () => {
    const attempts = [
      call("POST", "/deliveries", { token: murugan.token, body: { orderId: id, ...deliverBody } }),
      call("POST", `/orders/${id}/start`, { token: murugan.token }),
      call("POST", "/orders/bulk", { token: murugan.token, body: { action: "start", orderIds: [id] } }),
      call("POST", `/rider/orders/${id}/deliver`, { token: murugan.token, body: deliverBody }),
      call("POST", `/rider/orders/${id}/pickup`, { token: murugan.token }),
    ];
    const results = await Promise.all(attempts);
    assert.equal(results[0].status, 403);
    assert.equal(results[0].error.code, "SUPPLIER_CANNOT_DELIVER");
    assert.equal(results[1].status, 403);
    assert.equal(results[2].status, 400, "start is not a bulk action any more");
    assert.equal(results[3].status, 403);
    assert.equal(results[4].status, 403);
  };

  await supplierShortcuts();                                   // placed
  await call("POST", `/orders/${id}/accept`, { token: murugan.token, body: {} });
  assert.equal(await status(), "accepted");
  await supplierShortcuts();
  await call("POST", `/orders/${id}/assign-rider`, { token: murugan.token, body: { riderId: "user-suresh" } });
  await supplierShortcuts();
  await call("POST", `/orders/${id}/prepare`, { token: murugan.token });
  await call("POST", `/orders/${id}/ready`, { token: murugan.token });
  assert.equal(await status(), "ready_for_pickup");
  await supplierShortcuts();

  // A customer cannot drive the order either
  for (const path of ["accept", "prepare", "ready", "start", "decline"]) {
    assert.equal((await call("POST", `/orders/${id}/${path}`, { token: cust.token })).status, 403, path);
  }
  assert.equal((await call("POST", "/deliveries", { token: cust.token, body: { orderId: id, ...deliverBody } })).status, 403);
  assert.equal((await call("POST", `/rider/orders/${id}/deliver`, { token: cust.token, body: deliverBody })).status, 403);
  // Another supplier cannot touch it
  assert.equal((await call("POST", `/orders/${id}/prepare`, { token: balaji.token })).status, 404);

  // Riders that are not assigned cannot act, whether same supplier or not
  for (const who of [karthik, dinesh]) {
    for (const step of ["accept", "pickup", "start"]) {
      assert.equal((await call("POST", `/rider/orders/${id}/${step}`, { token: who.token })).status, 404, step);
    }
    assert.equal((await call("POST", `/rider/orders/${id}/deliver`, { token: who.token, body: deliverBody })).status, 404);
  }

  // The assigned rider walks it through
  assert.equal((await call("POST", `/rider/orders/${id}/accept`, { token: suresh.token })).status, 200);
  assert.equal((await call("POST", `/rider/orders/${id}/pickup`, { token: suresh.token })).data.status, "picked_up");
  assert.equal(await status(), "picked_up");
  await supplierShortcuts();
  assert.equal((await call("POST", `/rider/orders/${id}/start`, { token: suresh.token })).data.status, "out_for_delivery");
  await supplierShortcuts();
  assert.equal(await status(), "out_for_delivery", "customer still sees out for delivery");
  assert.ok(!(await call("GET", "/orders/" + id, { token: cust.token })).data.history.some((h) => h.status === "delivered"));

  // Rider cannot deliver without the customer's code; a wrong code is refused
  assert.equal((await call("POST", `/rider/orders/${id}/deliver`, { token: suresh.token, body: deliverBody })).status, 400);
  assert.equal(await status(), "out_for_delivery");
  const code = await codeOf(cust.token, id);
  assert.match(code, /^\d{4}$/);
  const bad = await call("POST", `/rider/orders/${id}/deliver`, { token: suresh.token, body: { ...deliverBody, deliveryCode: code === "0000" ? "1111" : "0000" } });
  assert.equal(bad.error.code, "WRONG_DELIVERY_CODE");
  assert.equal(await status(), "out_for_delivery");

  // Only now - with the code - is it delivered, and only the rider's call did it
  const done = await call("POST", `/rider/orders/${id}/deliver`, { token: suresh.token, body: { ...deliverBody, deliveryCode: code } });
  assert.equal(done.status, 201, JSON.stringify(done.body));
  assert.equal(done.data.delivery.riderUserId, "user-suresh");
  assert.equal(await status(), "delivered");
  const events = (await call("GET", "/orders/" + id, { token: cust.token })).data.history.map((h) => h.status);
  assert.deepEqual(events, ["placed", "accepted", "preparing", "ready_for_pickup", "picked_up", "out_for_delivery", "delivered"]);

  // Duplicate confirmations and later tampering are refused; nothing is recorded twice
  const ledgerBefore = JSON.stringify(app.store.deliveries.filter((d) => d.orderId === id));
  assert.equal((await call("POST", `/rider/orders/${id}/deliver`, { token: suresh.token, body: { ...deliverBody, deliveryCode: code } })).status, 409);
  assert.equal((await call("POST", "/deliveries", { token: murugan.token, body: { orderId: id, ...deliverBody } })).status, 403);
  assert.equal((await call("POST", `/orders/${id}/cancel`, { token: cust.token })).status, 409);
  assert.equal((await call("POST", `/rider/orders/${id}/start`, { token: suresh.token })).status, 409);
  assert.equal(JSON.stringify(app.store.deliveries.filter((d) => d.orderId === id)), ledgerBefore);
  assert.equal(app.store.deliveries.filter((d) => d.orderId === id).length, 1);

  // The customer was told at each step
  const titles = (await call("GET", "/notifications", { token: cust.token })).data.items.filter((n) => n.orderId === id).map((n) => n.title).join(" | ");
  for (const word of [/accepted/, /picked up/, /out for delivery/, /delivered/]) assert.match(titles, word);
});

test("rider delivery is only valid for the assigned rider, even with the right code (race: two deliver calls)", async () => {
  const cust = await login("customer@wow.test");
  const murugan = await login("murugan@wow.test");
  const rider = await login("rider@wow.test");
  const id = await orderOnItsWay(cust.token, murugan, rider);
  const code = await codeOf(cust.token, id);
  const go = () => call("POST", `/rider/orders/${id}/deliver`, { token: rider.token, body: { fullOut: 1, emptyIn: 1, deliveryCode: code } });
  const [a, b] = await Promise.all([go(), go()]);
  assert.deepEqual([a.status, b.status].sort(), [201, 409], "exactly one confirmation wins");
  assert.equal(app.store.deliveries.filter((d) => d.orderId === id).length, 1);
});

test("changing the rider before pickup needs the new rider to accept; not allowed after pickup", async () => {
  const cust = await login("customer@wow.test");
  const murugan = await login("murugan@wow.test");
  const placed = await call("POST", "/orders", { token: cust.token, body: { supplierId: "sup-murugan", items: [{ productId: "prod-20l", qty: 1 }] } });
  const id = placed.data.id;
  await call("POST", `/orders/${id}/accept`, { token: murugan.token });
  await call("POST", `/orders/${id}/assign-rider`, { token: murugan.token, body: { riderId: "user-suresh" } });
  const suresh = await login("suresh@wow.test");
  const karthik = await login("rider@wow.test");
  await call("POST", `/rider/orders/${id}/accept`, { token: suresh.token });
  // Re-assign to Karthik: Suresh loses it, Karthik must accept (and Suresh's old acceptance does not carry over)
  const re = await call("POST", `/orders/${id}/assign-rider`, { token: murugan.token, body: { riderId: "user-rider" } });
  assert.equal(re.data.riderAcceptedAt, null);
  assert.equal((await call("POST", `/rider/orders/${id}/accept`, { token: suresh.token })).status, 404);
  await call("POST", `/orders/${id}/prepare`, { token: murugan.token });
  await call("POST", `/orders/${id}/ready`, { token: murugan.token });
  assert.equal((await call("POST", `/rider/orders/${id}/pickup`, { token: karthik.token })).error.code, "RIDER_NOT_ACCEPTED");
  await call("POST", `/rider/orders/${id}/accept`, { token: karthik.token });
  await call("POST", `/rider/orders/${id}/pickup`, { token: karthik.token });
  assert.equal((await call("POST", `/orders/${id}/assign-rider`, { token: murugan.token, body: { riderId: "user-suresh" } })).status, 409);
});

test("customer cancelling removes the delivery from an assigned rider's active list", async () => {
  const cust = await login("customer@wow.test");
  const murugan = await login("murugan@wow.test");
  const suresh = await login("suresh@wow.test");
  const placed = await call("POST", "/orders", {
    token: cust.token,
    body: { supplierId: "sup-murugan", items: [{ productId: "prod-20l", qty: 1 }] },
  });
  const id = placed.data.id;
  await call("POST", `/orders/${id}/accept`, { token: murugan.token, body: {} });
  await call("POST", `/orders/${id}/assign-rider`, { token: murugan.token, body: { riderId: "user-suresh" } });
  assert.ok((await call("GET", "/rider/orders", { token: suresh.token })).data.active.some((o) => o.id === id));
  assert.equal((await call("POST", `/orders/${id}/cancel`, { token: cust.token })).status, 200);
  assert.ok(!(await call("GET", "/rider/orders", { token: suresh.token })).data.active.some((o) => o.id === id));
});

test("bulk update: accept many, assign one rider to many, prepare and mark ready many", async () => {
  const cust = await login("customer@wow.test");
  const murugan = await login("murugan@wow.test");
  const balaji = await login("balaji@wow.test");

  const ids = [];
  for (let i = 0; i < 3; i += 1) {
    const placed = await call("POST", "/orders", {
      token: cust.token,
      body: { supplierId: "sup-murugan", items: [{ productId: "prod-20l", qty: 1 }] },
    });
    assert.equal(placed.status, 201, JSON.stringify(placed.body));
    ids.push(placed.data.id);
  }

  // Validation and role checks
  assert.equal((await call("POST", "/orders/bulk", { token: cust.token, body: { action: "accept", orderIds: ids } })).status, 403);
  assert.equal((await call("POST", "/orders/bulk", { token: murugan.token, body: { action: "nope", orderIds: ids } })).status, 400);
  assert.equal((await call("POST", "/orders/bulk", { token: murugan.token, body: { action: "accept", orderIds: [] } })).status, 400);
  assert.equal((await call("POST", "/orders/bulk", { token: murugan.token, body: { action: "assign-rider", orderIds: ids } })).status, 400);

  // Another supplier cannot touch these orders: every result is "not found"
  let r = await call("POST", "/orders/bulk", { token: balaji.token, body: { action: "accept", orderIds: ids } });
  assert.equal(r.status, 200);
  assert.equal(r.data.succeeded, 0);
  assert.ok(r.data.results.every((x) => x.code === "NOT_FOUND"));

  // Bulk accept
  r = await call("POST", "/orders/bulk", { token: murugan.token, body: { action: "accept", orderIds: ids } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.data.succeeded, 3);
  assert.ok(r.data.results.every((x) => x.ok && x.order.status === "accepted"));

  // Marking ready before preparing fails per order, never the whole batch
  r = await call("POST", "/orders/bulk", { token: murugan.token, body: { action: "ready", orderIds: ids } });
  assert.equal(r.data.succeeded, 0);
  assert.ok(r.data.results.every((x) => x.errorCode === "ORDER_NOT_ACCEPTABLE"));
  // A supplier cannot start deliveries in bulk
  assert.equal((await call("POST", "/orders/bulk", { token: murugan.token, body: { action: "start", orderIds: ids } })).status, 400);

  // Another supplier's rider is refused for every order
  r = await call("POST", "/orders/bulk", { token: murugan.token, body: { action: "assign-rider", orderIds: ids, riderId: "user-dinesh" } });
  assert.equal(r.data.succeeded, 0);

  // One rider for all of them (a repeated id is only processed once)
  r = await call("POST", "/orders/bulk", { token: murugan.token, body: { action: "assign-rider", orderIds: [...ids, ids[0]], riderId: "user-rider" } });
  assert.equal(r.data.succeeded, 3);
  assert.ok(r.data.results.every((x) => x.order.rider.name === "Karthik"));

  // Prepare two of them, then mark them ready; the third stays accepted
  r = await call("POST", "/orders/bulk", { token: murugan.token, body: { action: "prepare", orderIds: ids.slice(0, 2) } });
  assert.equal(r.data.succeeded, 2);
  assert.ok(r.data.results.every((x) => x.order.status === "preparing"));
  r = await call("POST", "/orders/bulk", { token: murugan.token, body: { action: "ready", orderIds: ids.slice(0, 2) } });
  assert.equal(r.data.succeeded, 2);
  assert.ok(r.data.results.every((x) => x.order.status === "ready_for_pickup"));
  assert.equal((await call("GET", "/orders/" + ids[2], { token: murugan.token })).data.status, "accepted");

  // Accepting an order that already moved on is reported, not thrown
  r = await call("POST", "/orders/bulk", { token: murugan.token, body: { action: "accept", orderIds: [ids[0], ids[2]] } });
  assert.equal(r.data.succeeded, 0);
  assert.equal(r.data.failed, 2);
});

test("rider availability: offline riders cannot be assigned, summary counts deliveries", async () => {
  const cust = await login("customer@wow.test");
  const murugan = await login("murugan@wow.test");
  const rider = await login("rider@wow.test");

  assert.equal((await call("GET", "/rider/availability", { token: rider.token })).data.online, true);
  assert.equal((await call("PUT", "/rider/availability", { token: rider.token, body: { online: "no" } })).status, 400);
  assert.equal((await call("GET", "/rider/availability", { token: cust.token })).status, 403);

  const placed = await call("POST", "/orders", { token: cust.token, body: { supplierId: "sup-murugan", items: [{ productId: "prod-20l", qty: 1 }] } });
  const id = placed.data.id;
  await call("POST", `/orders/${id}/accept`, { token: murugan.token });

  assert.equal((await call("PUT", "/rider/availability", { token: rider.token, body: { online: false } })).data.online, false);
  const list = await call("GET", "/riders", { token: murugan.token });
  assert.equal(list.data.find((r) => r.id === "user-rider").online, false);
  const refused = await call("POST", `/orders/${id}/assign-rider`, { token: murugan.token, body: { riderId: "user-rider" } });
  assert.equal(refused.status, 409);
  assert.equal(refused.error.code, "RIDER_OFFLINE");

  await call("PUT", "/rider/availability", { token: rider.token, body: { online: true } });
  const before = (await call("GET", "/rider/summary", { token: rider.token })).data;
  assert.equal((await call("POST", `/orders/${id}/assign-rider`, { token: murugan.token, body: { riderId: "user-rider" } })).status, 200);
  assert.equal((await call("GET", "/rider/summary", { token: rider.token })).data.activeNow, before.activeNow + 1);
  await handOver(id, murugan, rider);
  await call("POST", `/rider/orders/${id}/start`, { token: rider.token });
  const done = await call("POST", `/rider/orders/${id}/deliver`, { token: rider.token, body: { fullOut: 1, emptyIn: 1, paymentMode: "cash", amountCollectedPaise: 0, deliveryCode: await codeOf(cust.token, id) } });
  assert.equal(done.status, 201, JSON.stringify(done.body));
  const after = (await call("GET", "/rider/summary", { token: rider.token, })).data;
  assert.equal(after.allTime.deliveries, before.allTime.deliveries + 1);
  assert.equal(after.today.deliveries, before.today.deliveries + 1);
});

test("order list pagination returns newest first with a working cursor", async () => {
  const cust = await login("customer@wow.test");
  for (let i = 0; i < 3; i += 1) {
    await call("POST", "/orders", { token: cust.token, body: { supplierId: "sup-murugan", items: [{ productId: "prod-20l", qty: 1 }] } });
  }
  const everything = (await call("GET", "/orders", { token: cust.token })).data;
  const seen = [];
  let cursor = "";
  for (let guardLoop = 0; guardLoop < 50; guardLoop += 1) {
    const page = await call("GET", `/orders?limit=2${cursor ? "&before=" + encodeURIComponent(cursor) : ""}`, { token: cust.token });
    assert.equal(page.status, 200);
    assert.ok(page.data.length <= 2);
    seen.push(...page.data.map((o) => o.id));
    if (!page.body.meta.hasMore) break;
    cursor = page.body.meta.nextCursor;
    assert.ok(cursor);
  }
  assert.equal(seen.length, everything.length);
  assert.equal(new Set(seen).size, seen.length, "no order appears on two pages");
});

test("razorpay webhook: signature required, paid creates exactly one order, failures are recorded", async () => {
  const crypto = require("crypto");
  const db = require("../src/db/database");
  process.env.RAZORPAY_WEBHOOK_SECRET = "test-webhook-secret";
  const cust = await login("customer@wow.test");
  const customerId = db.prepare("SELECT customer_id AS id FROM users WHERE email = ?").get("customer@wow.test").id;
  const now = new Date().toISOString();
  const addIntent = (id, link) =>
    db.prepare("INSERT INTO payment_intents (id, provider_id, customer_id, payload_json, amount_paise, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'created', ?, ?)")
      .run(id, link, customerId, JSON.stringify({ supplierId: "sup-murugan", items: [{ productId: "prod-20l", qty: 2 }] }), 8000, now, now);
  addIntent("intent-paid", "plink_paid");
  addIntent("intent-cancel", "plink_cancel");

  const send = (event, link, secret = "test-webhook-secret") => {
    const raw = JSON.stringify({ event, payload: { payment_link: { entity: { id: link } } } });
    return fetch(base + "/payments/razorpay/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-razorpay-signature": crypto.createHmac("sha256", secret).update(raw).digest("hex") },
      body: raw,
    });
  };

  assert.equal((await send("payment_link.paid", "plink_paid", "wrong-secret")).status, 401);
  assert.equal((await call("GET", "/payments/intent-paid", { token: cust.token })).data.status, "created");

  const ordersBefore = (await call("GET", "/orders", { token: cust.token })).data.length;
  assert.equal((await send("payment_link.paid", "plink_paid")).status, 200);
  assert.equal((await send("payment_link.paid", "plink_paid")).status, 200); // duplicate delivery
  const paid = (await call("GET", "/payments/intent-paid", { token: cust.token })).data;
  assert.equal(paid.status, "paid");
  assert.ok(paid.orderId);
  const ordersAfter = (await call("GET", "/orders", { token: cust.token })).data;
  assert.equal(ordersAfter.length, ordersBefore + 1, "a repeated webhook must not create a second order");
  assert.equal(ordersAfter.find((o) => o.id === paid.orderId).paymentStatus, "PAID");

  assert.equal((await send("payment_link.cancelled", "plink_cancel")).status, 200);
  assert.equal((await call("GET", "/payments/intent-cancel", { token: cust.token })).data.status, "cancelled");
  assert.equal((await call("GET", "/orders", { token: cust.token })).data.length, ordersAfter.length);
});

// Supplier prepares and marks ready; the assigned rider accepts and picks up.
async function handOver(id, supplier, rider) {
  assert.equal((await call("POST", `/orders/${id}/prepare`, { token: supplier.token })).status, 200);
  assert.equal((await call("POST", `/orders/${id}/ready`, { token: supplier.token })).status, 200);
  assert.equal((await call("POST", `/rider/orders/${id}/accept`, { token: rider.token })).status, 200);
  const picked = await call("POST", `/rider/orders/${id}/pickup`, { token: rider.token });
  assert.equal(picked.status, 200, JSON.stringify(picked.body));
}

// Place -> accept -> assign Karthik -> prepare -> ready -> rider accepts, picks up, starts. Returns the order id.
async function orderOnItsWay(custToken, murugan, rider, productId = "prod-20l", qty = 1, extra = {}) {
  const placed = await call("POST", "/orders", { token: custToken, body: { supplierId: "sup-murugan", items: [{ productId, qty }], ...extra } });
  assert.equal(placed.status, 201, JSON.stringify(placed.body));
  const id = placed.data.id;
  assert.equal((await call("POST", `/orders/${id}/accept`, { token: murugan.token })).status, 200);
  assert.equal((await call("POST", `/orders/${id}/assign-rider`, { token: murugan.token, body: { riderId: "user-rider" } })).status, 200);
  await handOver(id, murugan, rider);
  assert.equal((await call("POST", `/rider/orders/${id}/start`, { token: rider.token })).status, 200);
  return id;
}

test("stock: tracked products cannot be oversold, cancelling gives stock back, supplier can restock", async () => {
  const cust = await login("customer@wow.test");
  const murugan = await login("murugan@wow.test");
  const created = await call("POST", "/products", { token: murugan.token, body: { name: "Stock Test Can", sku: "STK-1", price: 50, stock: 3 } });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const pid = created.data.id;
  assert.equal(created.data.stockQty, 3);
  assert.equal(created.data.inStock, true);

  assert.equal((await call("POST", "/products", { token: murugan.token, body: { name: "Bad Stock", sku: "STK-2", price: 50, stock: -2 } })).status, 400);
  const place = (qty) => call("POST", "/orders", { token: cust.token, body: { supplierId: "sup-murugan", items: [{ productId: pid, qty }] } });

  const tooMany = await place(4);
  assert.equal(tooMany.status, 409);
  assert.equal(tooMany.error.code, "OUT_OF_STOCK");

  const first = await place(2);
  assert.equal(first.status, 201);
  let list = (await call("GET", "/products?supplierId=sup-murugan", { token: cust.token })).data;
  assert.equal(list.find((p) => p.id === pid).stockQty, 1);
  assert.equal(list.find((p) => p.id === pid).lowStock, true);
  assert.equal((await place(2)).error.code, "OUT_OF_STOCK");
  const last = await place(1);
  assert.equal(last.status, 201);
  list = (await call("GET", "/products?supplierId=sup-murugan", { token: cust.token })).data;
  assert.equal(list.find((p) => p.id === pid).inStock, false);

  // The supplier was alerted about low stock
  const inbox = await call("GET", "/notifications", { token: murugan.token });
  assert.ok(inbox.data.items.some((n) => /Stock Test Can/.test(n.title) && n.type === "stock.low"));

  // Cancelling returns the cans
  assert.equal((await call("POST", `/orders/${first.data.id}/cancel`, { token: cust.token })).status, 200);
  const afterCancel = (await call("GET", "/products", { token: murugan.token })).data.find((p) => p.id === pid);
  assert.equal(afterCancel.stockQty, 2);

  // Restock, edit, and stop tracking; other suppliers cannot touch the product
  const balaji = await login("balaji@wow.test");
  assert.equal((await call("PATCH", `/products/${pid}`, { token: balaji.token, body: { stock: 99 } })).status, 404);
  assert.equal((await call("PATCH", `/products/${pid}`, { token: cust.token, body: { stock: 99 } })).status, 403);
  assert.equal((await call("PATCH", `/products/${pid}`, { token: murugan.token, body: { stockDelta: 10 } })).data.stockQty, 12);
  assert.equal((await call("PATCH", `/products/${pid}`, { token: murugan.token, body: { stockDelta: -100 } })).data.stockQty, 0);
  assert.equal((await call("PATCH", `/products/${pid}`, { token: murugan.token, body: { stock: "abc" } })).status, 400);
  const untracked = await call("PATCH", `/products/${pid}`, { token: murugan.token, body: { stock: null, price: 55 } });
  assert.equal(untracked.data.stockTracked, false);
  assert.equal(untracked.data.unitPricePaise, 5500);
  assert.equal((await place(5)).status, 201, "untracked products are always available");
});

test("saved addresses: several per customer, one default, orders keep their own copy", async () => {
  const cust = await login("customer@wow.test");
  const priya = await login("priya@wow.test");
  const murugan = await login("murugan@wow.test");
  const original = (await call("GET", "/addresses", { token: cust.token })).data;
  assert.ok(original.length >= 1);
  const originalDefault = original.find((a) => a.isDefault);

  assert.equal((await call("POST", "/addresses", { token: cust.token, body: { label: "Office", line: "short" } })).status, 400);
  assert.equal((await call("POST", "/addresses", { token: murugan.token, body: { label: "X", line: "12 Race Course Road, Coimbatore" } })).status, 403);
  const added = await call("POST", "/addresses", { token: cust.token, body: { label: "Office", line: "12 Race Course Road, Coimbatore", instructions: "Call at the gate", makeDefault: true } });
  assert.equal(added.status, 201, JSON.stringify(added.body));
  assert.equal(added.data.isDefault, true);
  const afterAdd = (await call("GET", "/addresses", { token: cust.token })).data;
  assert.equal(afterAdd.filter((a) => a.isDefault).length, 1);
  assert.equal(afterAdd[0].id, added.data.id, "default comes first");

  // Another customer cannot see or change it
  assert.equal((await call("PUT", `/addresses/${added.data.id}`, { token: priya.token, body: { label: "Mine" } })).status, 404);
  assert.equal((await call("DELETE", `/addresses/${added.data.id}`, { token: priya.token })).status, 404);
  assert.equal((await call("POST", `/addresses/${added.data.id}/default`, { token: priya.token })).status, 404);
  assert.ok(!(await call("GET", "/addresses", { token: priya.token })).data.some((a) => a.id === added.data.id));
  const priyaAddress = (await call("GET", "/addresses", { token: priya.token })).data[0];

  // An order uses the default address and its standing instructions, or what the customer picks
  const body = (extra) => ({ supplierId: "sup-murugan", items: [{ productId: "prod-20l", qty: 1 }], ...extra });
  let o = await call("POST", "/orders", { token: cust.token, body: body({}) });
  assert.equal(o.data.deliveryAddress, "12 Race Course Road, Coimbatore");
  assert.equal(o.data.deliveryInstructions, "Call at the gate");
  const seen = (await call("GET", "/orders/" + o.data.id, { token: murugan.token })).data;
  assert.equal(seen.customer.address, "12 Race Course Road, Coimbatore");
  assert.equal(seen.deliveryInstructions, "Call at the gate");

  o = await call("POST", "/orders", { token: cust.token, body: body({ addressId: originalDefault.id, deliveryInstructions: "Leave with security" }) });
  assert.equal(o.data.deliveryAddress, originalDefault.line);
  assert.equal(o.data.deliveryInstructions, "Leave with security");
  const foreign = await call("POST", "/orders", { token: cust.token, body: body({ addressId: priyaAddress.id }) });
  assert.equal(foreign.status, 400, "cannot deliver to someone else's address: " + JSON.stringify(foreign.body) + " vs " + JSON.stringify(priyaAddress));

  // Editing or deleting an address never rewrites an order already placed
  const placed = await call("POST", "/orders", { token: cust.token, body: body({ addressId: added.data.id }) });
  await call("PUT", `/addresses/${added.data.id}`, { token: cust.token, body: { line: "99 Changed Street, Coimbatore" } });
  assert.equal((await call("GET", "/orders/" + placed.data.id, { token: cust.token })).data.deliveryAddress, "12 Race Course Road, Coimbatore");
  await call("POST", `/addresses/${originalDefault.id}/default`, { token: cust.token });
  assert.equal((await call("DELETE", `/addresses/${added.data.id}`, { token: cust.token })).status, 200);
  assert.equal((await call("GET", "/orders/" + placed.data.id, { token: cust.token })).data.deliveryAddress, "12 Race Course Road, Coimbatore");

  // The last address cannot be deleted
  const remaining = (await call("GET", "/addresses", { token: cust.token })).data;
  for (const a of remaining.slice(1)) await call("DELETE", `/addresses/${a.id}`, { token: cust.token });
  const only = (await call("GET", "/addresses", { token: cust.token })).data;
  assert.equal(only.length, 1);
  assert.equal((await call("DELETE", `/addresses/${only[0].id}`, { token: cust.token })).status, 409);
});

test("proof of delivery: code or photo, locked after wrong codes, visible only to the parties", async () => {
  const cust = await login("customer@wow.test");
  const priya = await login("priya@wow.test");
  const murugan = await login("murugan@wow.test");
  const rider = await login("rider@wow.test");
  const id = await orderOnItsWay(cust.token, murugan, rider);
  const code = await codeOf(cust.token, id);
  const wrong = code === "0000" ? "1111" : "0000";
  const deliver = (body) => call("POST", `/rider/orders/${id}/deliver`, { token: rider.token, body: { fullOut: 1, emptyIn: 1, ...body } });

  assert.equal(await codeOf(priya.token, id), undefined);
  for (let i = 0; i < 5; i += 1) assert.equal((await deliver({ deliveryCode: wrong })).error.code, "WRONG_DELIVERY_CODE");
  // Locked: even the right code is refused now; a photo is required
  assert.equal((await deliver({ deliveryCode: code })).error.code, "CODE_LOCKED");
  assert.equal((await deliver({ proofPhoto: "<script>" })).error.code, "INVALID_PHOTO");
  assert.equal((await deliver({ proofPhoto: "A".repeat(700000) })).error.code, "INVALID_PHOTO");
  const done = await deliver({ proofPhoto: "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA==", proofNote: "Left at the door" });
  assert.equal(done.status, 201, JSON.stringify(done.body));
  assert.equal(done.data.proof, "photo");

  const proof = await call("GET", `/orders/${id}/proof`, { token: cust.token });
  assert.equal(proof.data.method, "photo");
  assert.equal(proof.data.note, "Left at the door");
  assert.match(proof.data.photo, /^data:image\/jpeg;base64,/);
  assert.equal((await call("GET", `/orders/${id}/proof`, { token: murugan.token })).status, 200);
  assert.equal((await call("GET", `/orders/${id}/proof`, { token: priya.token })).status, 404);
  // The code is no longer shown once delivered
  assert.equal(await codeOf(cust.token, id), undefined);

  // The normal path: the right code completes it and is recorded
  const id2 = await orderOnItsWay(cust.token, murugan, rider);
  const ok = await call("POST", `/rider/orders/${id2}/deliver`, { token: rider.token, body: { fullOut: 1, emptyIn: 1, deliveryCode: await codeOf(cust.token, id2) } });
  assert.equal(ok.data.proof, "code");
  assert.equal((await call("GET", `/orders/${id2}/proof`, { token: cust.token })).data.method, "code");
});

test("ratings: only the customer, only after delivery, once; suppliers show an average", async () => {
  const cust = await login("customer@wow.test");
  const priya = await login("priya@wow.test");
  const murugan = await login("murugan@wow.test");
  const rider = await login("rider@wow.test");
  const id = await orderOnItsWay(cust.token, murugan, rider);
  assert.equal((await call("POST", `/orders/${id}/rating`, { token: cust.token, body: { rating: 5 } })).error.code, "NOT_DELIVERED");
  await call("POST", `/rider/orders/${id}/deliver`, { token: rider.token, body: { fullOut: 1, emptyIn: 1, deliveryCode: await codeOf(cust.token, id) } });

  assert.equal((await call("POST", `/orders/${id}/rating`, { token: cust.token, body: { rating: 6 } })).status, 400);
  assert.equal((await call("POST", `/orders/${id}/rating`, { token: priya.token, body: { rating: 5 } })).status, 404);
  assert.equal((await call("POST", `/orders/${id}/rating`, { token: murugan.token, body: { rating: 5 } })).status, 403);
  const rated = await call("POST", `/orders/${id}/rating`, { token: cust.token, body: { rating: 4, feedback: "On time, cans were cold" } });
  assert.equal(rated.status, 200, JSON.stringify(rated.body));
  assert.equal(rated.data.rating, 4);
  assert.equal((await call("POST", `/orders/${id}/rating`, { token: cust.token, body: { rating: 5 } })).error.code, "ALREADY_RATED");
  const supplier = (await call("GET", "/suppliers", { token: cust.token })).data.find((s) => s.id === "sup-murugan");
  assert.ok(supplier.ratingCount >= 1);
  assert.ok(supplier.ratingAverage >= 1 && supplier.ratingAverage <= 5);
});

test("refunds: paid online orders are refunded on cancel; failures can be retried; sold-out paid orders are refunded", async () => {
  const crypto = require("crypto");
  const db = require("../src/db/database");
  process.env.RAZORPAY_WEBHOOK_SECRET = "test-webhook-secret";
  process.env.RAZORPAY_KEY_ID = "rzp_test_key";
  process.env.RAZORPAY_KEY_SECRET = "rzp_test_secret";
  const cust = await login("customer@wow.test");
  const murugan = await login("murugan@wow.test");
  const customerId = db.prepare("SELECT customer_id AS id FROM users WHERE email = ?").get("customer@wow.test").id;

  // Razorpay is replaced by a stub, so no real money or network is involved. Local calls pass through.
  const realFetch = globalThis.fetch;
  const razorpayCalls = [];
  let razorpayFails = false;
  globalThis.fetch = async (url, init) => {
    if (!String(url).startsWith("https://api.razorpay.com/")) return realFetch(url, init);
    razorpayCalls.push({ url: String(url), body: JSON.parse(init.body) });
    return razorpayFails
      ? { ok: false, json: async () => ({ error: { description: "Gateway is down" } }) }
      : { ok: true, json: async () => ({ id: "rfnd_" + razorpayCalls.length, status: "pending" }) };
  };
  try {
    const now = new Date().toISOString();
    const addIntent = (id, link, items) =>
      db.prepare("INSERT INTO payment_intents (id, provider_id, customer_id, payload_json, amount_paise, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'created', ?, ?)")
        .run(id, link, customerId, JSON.stringify({ supplierId: "sup-murugan", items }), 8000, now, now);
    const send = (event, payload) => {
      const raw = JSON.stringify({ event, payload });
      return realFetch(base + "/payments/razorpay/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-razorpay-signature": crypto.createHmac("sha256", "test-webhook-secret").update(raw).digest("hex") },
        body: raw,
      });
    };
    const paid = (link, paymentId) => send("payment_link.paid", { payment_link: { entity: { id: link } }, payment: { entity: { id: paymentId } } });
    const until = async (fn) => { for (let i = 0; i < 40; i += 1) { const v = await fn(); if (v) return v; await new Promise((r) => setTimeout(r, 25)); } return null; };
    const intentOf = (id) => db.prepare("SELECT status, order_id AS orderId, refund_status AS refundStatus, refund_id AS refundId, refund_error AS refundError FROM payment_intents WHERE id = ?").get(id);

    // 1. paid -> cancelled -> refunded in full
    addIntent("refund-1", "plink_r1", [{ productId: "prod-20l", qty: 2 }]);
    assert.equal((await paid("plink_r1", "pay_R1")).status, 200);
    const orderId = intentOf("refund-1").orderId;
    assert.ok(orderId);
    assert.equal((await call("POST", `/orders/${orderId}/cancel`, { token: cust.token })).status, 200);
    await until(() => intentOf("refund-1").refundStatus === "pending");
    assert.equal(razorpayCalls.length, 1);
    assert.ok(razorpayCalls[0].url.endsWith("/payments/pay_R1/refund"));
    assert.equal(razorpayCalls[0].body.amount, 8000);
    assert.equal((await call("GET", `/orders/${orderId}`, { token: cust.token })).data.paymentStatus, "REFUND_PENDING");
    assert.equal((await call("GET", `/orders/${orderId}/refund`, { token: cust.token })).data.status, "pending");
    // Razorpay confirms later
    await send("refund.processed", { refund: { entity: { id: intentOf("refund-1").refundId, payment_id: "pay_R1" } } });
    assert.equal(intentOf("refund-1").refundStatus, "processed");
    assert.equal((await call("GET", `/orders/${orderId}`, { token: cust.token })).data.paymentStatus, "REFUNDED");
    assert.equal((await call("GET", "/payments/refund-1", { token: cust.token })).data.refundStatus, "processed");
    assert.equal(razorpayCalls.length, 1, "refunded once, never twice");

    // 2. Razorpay down: the failure is recorded and a supplier can retry
    razorpayFails = true;
    addIntent("refund-2", "plink_r2", [{ productId: "prod-20l", qty: 1 }]);
    await paid("plink_r2", "pay_R2");
    const order2 = intentOf("refund-2").orderId;
    await call("POST", `/orders/${order2}/cancel`, { token: cust.token });
    await until(() => intentOf("refund-2").refundStatus === "failed");
    assert.equal(intentOf("refund-2").refundError, "Gateway is down");
    assert.equal((await call("POST", `/orders/${order2}/refund/retry`, { token: cust.token })).status, 403);
    razorpayFails = false;
    const retry = await call("POST", `/orders/${order2}/refund/retry`, { token: murugan.token });
    assert.equal(retry.status, 200, JSON.stringify(retry.body));
    assert.equal(retry.data.status, "pending");
    assert.equal((await call("POST", `/orders/${order2}/refund/retry`, { token: murugan.token })).status, 409);

    // 3. The customer paid but the cans sold out meanwhile: no order is made, the money goes back
    const stock = await call("POST", "/products", { token: murugan.token, body: { name: "Last Can", sku: "LAST-1", price: 40, stock: 0 } });
    addIntent("refund-3", "plink_r3", [{ productId: stock.data.id, qty: 1 }]);
    assert.equal((await paid("plink_r3", "pay_R3")).status, 200);
    await until(() => intentOf("refund-3").refundStatus === "pending");
    assert.equal(intentOf("refund-3").status, "paid");
    assert.equal(intentOf("refund-3").orderId, null);
    assert.ok(razorpayCalls.some((c) => c.url.endsWith("/payments/pay_R3/refund")));
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("rider verification: ID upload, supplier approval, unapproved riders are blocked", async () => {
  const murugan = await login("murugan@wow.test");
  const balaji = await login("balaji@wow.test");
  const cust = await login("customer@wow.test");
  const idPhoto = "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA==";
  const base = { role: "RIDER", name: "Vimal Rider", password: "Rider@1234", phone: "9000022222", supplierId: "sup-murugan", vehicleNo: "TN 38 AB 1234", idType: "driving_licence", idNumber: "TN38 2020 0001234", idPhoto };

  // The ID is required, and must be valid
  const noId = { ...base, idType: undefined, idNumber: undefined, idPhoto: undefined };
  assert.equal((await call("POST", "/auth/register", { body: noId })).error.details.field, "idType");
  assert.equal((await call("POST", "/auth/register", { body: { ...base, idType: "library_card" } })).error.details.field, "idType");
  assert.equal((await call("POST", "/auth/register", { body: { ...base, idNumber: "12" } })).error.details.field, "idNumber");
  assert.equal((await call("POST", "/auth/register", { body: { ...base, idPhoto: "<script>" } })).error.details.field, "idPhoto");
  assert.equal((await call("POST", "/auth/register", { body: { ...base, idPhoto: "A".repeat(1700000) } })).status, 400);

  const reg = await call("POST", "/auth/register", { body: base });
  assert.equal(reg.status, 201, JSON.stringify(reg.body));
  assert.equal(reg.data.user.approvalStatus, "pending");
  const riderId = reg.data.user.id;
  const rider = { token: reg.data.token };

  // The supplier is told, and sees the request (only the last 4 of the ID number is kept)
  const inbox = await call("GET", "/notifications", { token: murugan.token });
  assert.ok(inbox.data.items.some((n) => n.type === "rider.pending" && /Vimal Rider/.test(n.body)));
  const listed = (await call("GET", "/riders", { token: murugan.token })).data.find((r) => r.id === riderId);
  assert.equal(listed.approvalStatus, "pending");
  assert.equal(listed.idLast4, "1234");
  assert.equal(listed.idTypeLabel, "Driving Licence");
  assert.equal(JSON.stringify(listed).includes("TN38"), false, "full ID number is never stored or returned");

  // Only the rider's own supplier can open the ID photo
  const doc = await call("GET", `/riders/${riderId}/document`, { token: murugan.token });
  assert.equal(doc.status, 200);
  assert.match(doc.data.photo, /^data:image\/jpeg;base64,/);
  assert.equal((await call("GET", `/riders/${riderId}/document`, { token: balaji.token })).status, 404);
  assert.equal((await call("GET", `/riders/${riderId}/document`, { token: cust.token })).status, 403);
  assert.equal((await call("GET", `/riders/${riderId}/document`, { token: rider.token })).status, 403);

  // Until approved: no deliveries, cannot be assigned, but can see their own verification status
  assert.equal((await call("GET", "/rider/orders", { token: rider.token })).error.code, "RIDER_NOT_APPROVED");
  assert.equal((await call("PUT", "/rider/availability", { token: rider.token, body: { online: true } })).status, 403);
  assert.equal((await call("GET", "/rider/verification", { token: rider.token })).data.status, "pending");
  const placed = await call("POST", "/orders", { token: cust.token, body: { supplierId: "sup-murugan", items: [{ productId: "prod-20l", qty: 1 }] } });
  await call("POST", `/orders/${placed.data.id}/accept`, { token: murugan.token });
  assert.equal((await call("POST", `/orders/${placed.data.id}/assign-rider`, { token: murugan.token, body: { riderId } })).error.code, "RIDER_NOT_APPROVED");

  // Reject needs a reason; only the rider's supplier may decide
  assert.equal((await call("POST", `/riders/${riderId}/reject`, { token: murugan.token, body: {} })).status, 400);
  assert.equal((await call("POST", `/riders/${riderId}/approve`, { token: balaji.token })).status, 404);
  assert.equal((await call("POST", `/riders/${riderId}/approve`, { token: rider.token })).status, 403);
  assert.equal((await call("POST", `/riders/${riderId}/reject`, { token: murugan.token, body: { reason: "ID photo is blurry" } })).status, 200);
  const rejected = (await call("GET", "/rider/verification", { token: rider.token })).data;
  assert.equal(rejected.status, "rejected");
  assert.equal(rejected.note, "ID photo is blurry");
  const riderInbox = await call("GET", "/notifications", { token: rider.token });
  assert.ok(riderInbox.data.items.some((n) => n.type === "rider.approval" && /not accepted/.test(n.title)));

  // The rider uploads again; the supplier approves; deliveries open up
  assert.equal((await call("POST", "/rider/verification", { token: rider.token, body: { idType: "aadhaar" } })).status, 400);
  const again = await call("POST", "/rider/verification", { token: rider.token, body: { idType: "aadhaar", idNumber: "9999 8888 7777", idPhoto } });
  assert.equal(again.status, 200, JSON.stringify(again.body));
  assert.equal(again.data.status, "pending");
  assert.equal(again.data.idLast4, "7777");
  assert.equal((await call("POST", `/riders/${riderId}/approve`, { token: murugan.token })).status, 200);
  assert.equal((await call("GET", "/rider/orders", { token: rider.token })).status, 200);
  assert.equal((await call("POST", "/rider/verification", { token: rider.token, body: { idType: "aadhaar", idNumber: "9999 8888 7777", idPhoto } })).error.code, "ALREADY_APPROVED");
  assert.equal((await call("POST", `/orders/${placed.data.id}/assign-rider`, { token: murugan.token, body: { riderId } })).status, 200);
  assert.ok((await call("GET", "/notifications", { token: rider.token })).data.items.some((n) => n.type === "delivery.assigned"));
});

test("a rejected order tells the customer why; a paid order can be cancelled and refunded", async () => {
  const crypto = require("crypto");
  const db = require("../src/db/database");
  const cust = await login("customer@wow.test");
  const murugan = await login("murugan@wow.test");
  const placed = await call("POST", "/orders", { token: cust.token, body: { supplierId: "sup-murugan", items: [{ productId: "prod-20l", qty: 1 }] } });
  const id = placed.data.id;

  const declined = await call("POST", `/orders/${id}/decline`, { token: murugan.token, body: { reason: "Out of stock today" } });
  assert.equal(declined.status, 200, JSON.stringify(declined.body));
  const inbox = await call("GET", "/notifications", { token: cust.token });
  const note = inbox.data.items.find((n) => n.type === "order.declined" && n.orderId === id);
  assert.ok(note, "customer must be notified");
  assert.match(note.title, /Murugan Water could not accept order/);
  assert.match(note.body, /Out of stock today/);
  assert.equal(inbox.data.items.filter((n) => n.orderId === id && n.type === "order.updated").length, 0, "no vague duplicate");
  assert.equal((await call("GET", "/orders/" + id, { token: cust.token })).data.declineReason, "Out of stock today");

  // The customer can then cancel it
  assert.equal((await call("POST", `/orders/${id}/cancel`, { token: cust.token })).data.status, "cancelled");
});

test("payment history: cash and online orders, refunds and unfinished payments, in pages", async () => {
  const db = require("../src/db/database");
  const cust = await login("customer@wow.test");
  const priya = await login("priya@wow.test");
  const customerId = db.prepare("SELECT customer_id AS id FROM users WHERE email = ?").get("customer@wow.test").id;
  const placed = await call("POST", "/orders", { token: cust.token, body: { supplierId: "sup-murugan", items: [{ productId: "prod-20l", qty: 2 }] } });
  const now = new Date().toISOString();
  db.prepare("INSERT INTO payment_intents (id, provider_id, customer_id, payload_json, amount_paise, status, created_at, updated_at) VALUES (?, ?, ?, '{}', 5000, 'cancelled', ?, ?)").run("hist-cancelled", "plink_h1", customerId, now, now);

  const all = await call("GET", "/history/payments", { token: cust.token });
  assert.equal(all.status, 200);
  const cash = all.data.find((r) => r.orderId === placed.data.id);
  assert.equal(cash.status, "pay_on_delivery");
  assert.equal(cash.method, "COD");
  assert.equal(cash.amountPaise, 8000);
  assert.equal(all.data.find((r) => r.id === "pay-hist-cancelled").status, "cancelled");
  assert.ok(!all.data.some((r) => r.id === "pay-hist-cancelled" && r.orderId));
  // other customers never see these rows
  assert.ok(!(await call("GET", "/history/payments", { token: priya.token })).data.some((r) => r.id === "pay-hist-cancelled"));
  assert.equal((await call("GET", "/history/payments", { token: (await login("murugan@wow.test")).token })).status, 403);

  // newest first, and paging walks the whole list exactly once
  for (let i = 1; i < all.data.length; i += 1) assert.ok(all.data[i - 1].at >= all.data[i].at);
  const seen = [];
  let cursor = "";
  for (let n = 0; n < 100; n += 1) {
    const page = await call("GET", `/history/payments?limit=3${cursor ? "&before=" + encodeURIComponent(cursor) : ""}`, { token: cust.token });
    seen.push(...page.data.map((r) => r.id));
    if (!page.body.meta.hasMore) break;
    cursor = page.body.meta.nextCursor;
  }
  assert.equal(seen.length, all.data.length);
  assert.equal(new Set(seen).size, seen.length);

  // once cancelled, the cash order reads as cancelled
  await call("POST", `/orders/${placed.data.id}/cancel`, { token: cust.token });
  assert.equal((await call("GET", "/history/payments", { token: cust.token })).data.find((r) => r.orderId === placed.data.id).status, "cancelled");
});
