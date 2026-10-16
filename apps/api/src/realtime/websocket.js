/*
 * WebSocket endpoint for the mobile apps:  ws://host:port/v1/ws
 *
 * React Native has no EventSource (the web app's live stream), but it has a
 * built-in WebSocket. This is a small RFC 6455 server (no dependencies) that
 * plugs into the same hub, so a socket receives exactly the events the same
 * user would receive over SSE - and never anyone else's.
 *
 * Protocol (JSON text frames):
 *   client -> { "type": "auth", "token": "<session token>" }   (first message)
 *   server -> { "event": "ready", "data": { "role": "...", ... } }
 *   server -> { "event": "order.updated", "data": { ... } }    (live events)
 *   server -> { "event": "pong" }    in reply to  client -> { "type": "ping" }
 *
 * The token travels in the first message, not in the URL, so it never lands
 * in server or proxy logs.
 */
const crypto = require("crypto");
const config = require("../config");
const { recipientOf } = require("../modules/notifications/notification.routes");

const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const MAX_PAYLOAD = 64 * 1024;
const AUTH_TIMEOUT_MS = 8000;

function frame(opcode, payload) {
  const body = Buffer.isBuffer(payload) ? payload : Buffer.from(payload || "");
  let header;
  if (body.length < 126) {
    header = Buffer.from([0x80 | opcode, body.length]);
  } else if (body.length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(body.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(body.length), 2);
  }
  return Buffer.concat([header, body]);
}

function attachWebSocket(server, { hub, auth }) {
  server.on("upgrade", (req, socket) => {
    const path = (req.url || "").split("?")[0];
    const key = req.headers["sec-websocket-key"];
    if (path !== "/v1/ws" || !key || String(req.headers.upgrade).toLowerCase() !== "websocket") {
      socket.write("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }

    const accept = crypto.createHash("sha1").update(key + GUID).digest("base64");
    socket.write(
      "HTTP/1.1 101 Switching Protocols\r\n" +
        "Upgrade: websocket\r\nConnection: Upgrade\r\n" +
        "Sec-WebSocket-Accept: " + accept + "\r\n\r\n"
    );
    socket.setNoDelay(true);

    let buffer = Buffer.alloc(0);
    let fragments = null; // { opcode, chunks }
    let detach = null;
    let closed = false;

    const sendJson = (obj) => {
      if (!closed && socket.writable) socket.write(frame(0x1, JSON.stringify(obj)));
    };
    const closeSocket = (code = 1000) => {
      if (closed) return;
      closed = true;
      try {
        const b = Buffer.alloc(2);
        b.writeUInt16BE(code, 0);
        socket.write(frame(0x8, b));
      } catch (e) { /* ignore */ }
      socket.end();
      cleanup();
    };
    const cleanup = () => {
      closed = true;
      clearTimeout(authTimer);
      clearInterval(heartbeat);
      if (detach) detach();
      detach = null;
    };

    const authTimer = setTimeout(() => closeSocket(1008), AUTH_TIMEOUT_MS);
    const heartbeat = setInterval(() => {
      if (!closed && socket.writable) socket.write(frame(0x9, ""));
    }, config.sseHeartbeatMs);

    function onMessage(text) {
      let msg;
      try { msg = JSON.parse(text); } catch (e) { return; }
      if (!msg || typeof msg !== "object") return;

      if (msg.type === "ping") {
        sendJson({ event: "pong" });
        return;
      }
      if (msg.type === "auth" && !detach) {
        const session = typeof msg.token === "string" ? auth.authenticate(msg.token) : null;
        if (!session) {
          sendJson({ event: "unauthorized" });
          closeSocket(1008);
          return;
        }
        clearTimeout(authTimer);
        const recipient = recipientOf(session.user);
        detach = hub.subscribeTarget(recipient, {
          send: (event, data) => sendJson({ event, data }),
          close: () => closeSocket(1001),
        });
        sendJson({ event: "ready", data: { role: session.user.role } });
      }
    }

    function parse() {
      while (buffer.length >= 2) {
        const fin = (buffer[0] & 0x80) !== 0;
        const opcode = buffer[0] & 0x0f;
        const masked = (buffer[1] & 0x80) !== 0;
        let len = buffer[1] & 0x7f;
        let offset = 2;
        if (len === 126) {
          if (buffer.length < 4) return;
          len = buffer.readUInt16BE(2);
          offset = 4;
        } else if (len === 127) {
          if (buffer.length < 10) return;
          const big = buffer.readBigUInt64BE(2);
          if (big > BigInt(MAX_PAYLOAD)) return closeSocket(1009);
          len = Number(big);
          offset = 10;
        }
        if (len > MAX_PAYLOAD) return closeSocket(1009);
        if (!masked) return closeSocket(1002); // clients must mask (RFC 6455)
        if (buffer.length < offset + 4 + len) return;

        const mask = buffer.subarray(offset, offset + 4);
        const data = Buffer.from(buffer.subarray(offset + 4, offset + 4 + len));
        for (let i = 0; i < data.length; i++) data[i] ^= mask[i % 4];
        buffer = buffer.subarray(offset + 4 + len);

        if (opcode === 0x8) return closeSocket(1000);
        if (opcode === 0x9) { socket.write(frame(0xa, data)); continue; }
        if (opcode === 0xa) continue;

        if (opcode === 0x1 || opcode === 0x2) {
          if (fin) onMessage(data.toString("utf8"));
          else fragments = { chunks: [data] };
        } else if (opcode === 0x0 && fragments) {
          fragments.chunks.push(data);
          if (fragments.chunks.reduce((n, c) => n + c.length, 0) > MAX_PAYLOAD) return closeSocket(1009);
          if (fin) {
            const text = Buffer.concat(fragments.chunks).toString("utf8");
            fragments = null;
            onMessage(text);
          }
        }
      }
    }

    socket.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      parse();
    });
    socket.on("close", cleanup);
    socket.on("error", cleanup);
  });
}

module.exports = { attachWebSocket };
