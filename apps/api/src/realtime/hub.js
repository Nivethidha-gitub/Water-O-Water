/*
 * Server-Sent Events hub.
 *
 * Every open /v1/events connection is registered under the recipient it
 * belongs to ("SUPPLIER:sup-123" or "CUSTOMER:cust-456"). An event published
 * to a recipient is only ever written to that recipient's connections, so a
 * supplier can never receive another supplier's order notifications.
 */
const config = require("../config");
const { corsHeaders } = require("../http/send");

function createHub() {
  // key -> Set<{ send(eventName, payload), close() }>.
  // A target is either an SSE response (web app) or a WebSocket (mobile app).
  const clients = new Map();

  function keyFor(type, id) {
    return type + ":" + id;
  }

  function subscribe(req, res, { type, id }) {
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      ...corsHeaders(),
    });
    res.write("retry: 3000\n\n");
    res.write("event: ready\ndata: {}\n\n");

    const target = {
      send(eventName, payload) {
        res.write("event: " + eventName + "\ndata: " + JSON.stringify(payload) + "\n\n");
      },
      close() {
        res.end();
      },
    };
    const detach = attach(keyFor(type, id), target);

    const heartbeat = setInterval(() => {
      res.write(": ping\n\n");
    }, config.sseHeartbeatMs);

    req.on("close", () => {
      clearInterval(heartbeat);
      detach();
    });
  }

  /** Registers a target under a recipient key; returns a function that removes it. */
  function attach(key, target) {
    if (!clients.has(key)) clients.set(key, new Set());
    clients.get(key).add(target);
    return () => {
      const set = clients.get(key);
      if (set) {
        set.delete(target);
        if (set.size === 0) clients.delete(key);
      }
    };
  }

  /** WebSocket subscription (see websocket.js). `target` has send() and close(). */
  function subscribeTarget({ type, id }, target) {
    return attach(keyFor(type, id), target);
  }

  function publish(type, id, eventName, payload) {
    const set = clients.get(keyFor(type, id));
    if (!set) return 0;
    for (const target of [...set]) {
      try {
        target.send(eventName, payload);
      } catch (e) {
        /* a dead connection removes itself on close */
      }
    }
    return set.size;
  }

  function connectionCount(type, id) {
    const set = clients.get(keyFor(type, id));
    return set ? set.size : 0;
  }

  function closeAll() {
    for (const set of clients.values()) {
      for (const target of [...set]) target.close();
    }
    clients.clear();
  }

  return { subscribe, subscribeTarget, publish, connectionCount, closeAll };
}

module.exports = { createHub };
