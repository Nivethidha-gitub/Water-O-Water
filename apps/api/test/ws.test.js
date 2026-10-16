const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");

process.env.WOW_DB_PATH = ":memory:";
process.env.WOW_QUIET = "1";

const { createApp, handleRequest } = require("../src/app");
const { attachWebSocket } = require("../src/realtime/websocket");

let app, server, base, wsBase;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test.before(async () => {
  app = await createApp();
  server = http.createServer((req, res) => handleRequest(app, req, res));
  attachWebSocket(server, app);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  base = `http://127.0.0.1:${port}/v1`;
  wsBase = `ws://127.0.0.1:${port}/v1/ws`;
});
test.after(() => { app.hub.closeAll(); server.close(); server.closeAllConnections && server.closeAllConnections(); });

async function call(method, path, { token, body } = {}) {
  const r = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, json: await r.json() };
}
const login = async (id) =>
  (await call("POST", "/auth/login", { body: { identifier: id, password: "Water@123" } })).json.data;

/** Opens a socket, sends auth, resolves once ready (or closed). */
function openSocket(token) {
  return new Promise((resolve) => {
    const ws = new WebSocket(wsBase);
    const s = { ws, events: [], closed: false, closeCode: null };
    ws.onmessage = (m) => {
      const msg = JSON.parse(m.data);
      s.events.push(msg);
      if (msg.event === "ready" || msg.event === "unauthorized") resolve(s);
    };
    ws.onclose = (e) => { s.closed = true; s.closeCode = e.code; resolve(s); };
    ws.onopen = () => ws.send(JSON.stringify({ type: "auth", token }));
  });
}

test("websocket: valid token -> ready with role; bad token -> rejected and closed", async () => {
  const cust = await login("customer@wow.test");
  const ok = await openSocket(cust.token);
  assert.equal(ok.events[0].event, "ready");
  assert.equal(ok.events[0].data.role, "CUSTOMER");

  ok.ws.send(JSON.stringify({ type: "ping" }));
  await wait(150);
  assert.ok(ok.events.some((e) => e.event === "pong"));
  ok.ws.close();

  const bad = await openSocket("not-a-real-token");
  assert.equal(bad.events[0].event, "unauthorized");
  await wait(150);
  assert.equal(bad.closed, true);
});

test("websocket: wrong path / non-websocket upgrade is refused", async () => {
  await assert.rejects(
    new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${server.address().port}/v1/nope`);
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error("refused"));
    }),
    /refused/
  );
});

test("websocket: live events reach only the right users across the whole order flow", async () => {
  const cust = await login("customer@wow.test");
  const priya = await login("priya@wow.test");
  const murugan = await login("murugan@wow.test");
  const balaji = await login("balaji@wow.test");
  const karthik = await login("rider@wow.test");
  const dinesh = await login("dinesh@wow.test");

  const sockets = {
    cust: await openSocket(cust.token),
    priya: await openSocket(priya.token),
    murugan: await openSocket(murugan.token),
    balaji: await openSocket(balaji.token),
    karthik: await openSocket(karthik.token),
    dinesh: await openSocket(dinesh.token),
  };
  const got = (s, id) => s.events.filter((e) => e.data && e.data.order && e.data.order.id === id);

  // customer places -> the supplier hears about it instantly, nobody else does
  const placed = await call("POST", "/orders", {
    token: cust.token,
    body: { supplierId: "sup-murugan", items: [{ productId: "prod-20l", qty: 1 }] },
  });
  const id = placed.json.data.id;
  await wait(250);
  assert.ok(got(sockets.murugan, id).length >= 1, "supplier got new order live");
  assert.equal(got(sockets.balaji, id).length, 0, "other supplier hears nothing");
  assert.equal(got(sockets.priya, id).length, 0, "other customer hears nothing");

  // accept -> customer hears
  await call("POST", `/orders/${id}/accept`, { token: murugan.token, body: {} });
  await wait(250);
  assert.ok(got(sockets.cust, id).length >= 1, "customer told of acceptance live");

  // assign rider -> that rider (only) is told
  await call("POST", `/orders/${id}/assign-rider`, { token: murugan.token, body: { riderId: "user-rider" } });
  await wait(250);
  assert.ok(got(sockets.karthik, id).length >= 1, "assigned rider told live");
  assert.equal(got(sockets.dinesh, id).length, 0, "other supplier's rider not told");

  // rider starts + delivers -> customer and supplier both hear
  const before = { c: got(sockets.cust, id).length, m: got(sockets.murugan, id).length };
  await call("POST", `/orders/${id}/prepare`, { token: murugan.token });
  await call("POST", `/orders/${id}/ready`, { token: murugan.token });
  await call("POST", `/rider/orders/${id}/accept`, { token: karthik.token });
  await call("POST", `/rider/orders/${id}/pickup`, { token: karthik.token });
  await call("POST", `/rider/orders/${id}/start`, { token: karthik.token });
  const deliveryCode = (await call("GET", "/orders/" + id, { token: cust.token })).json.data.deliveryCode;
  await call("POST", `/rider/orders/${id}/deliver`, { token: karthik.token, body: { fullOut: 1, emptyIn: 1, amountCollectedPaise: 4000, deliveryCode } });
  await wait(300);
  assert.ok(got(sockets.cust, id).length > before.c, "customer told of delivery live");
  assert.ok(got(sockets.murugan, id).length > before.m, "supplier told of rider's delivery live");
  const last = got(sockets.cust, id).pop();
  assert.equal(last.data.order.status, "delivered");

  // a socket never sees data after sign-out is not required here, but closing is clean
  Object.values(sockets).forEach((s) => s.ws.close());
});
