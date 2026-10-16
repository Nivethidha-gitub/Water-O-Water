const http = require("http");
const config = require("./config");
const { createApp, handleRequest } = require("./app");
const { createStaticHandler } = require("./http/static");
const { attachWebSocket } = require("./realtime/websocket");

createApp()
  .then((app) => {
    const serveWeb = createStaticHandler();
    const server = http.createServer((req, res) => {
      if (serveWeb && !req.url.startsWith("/v1") && serveWeb(req, res)) return;
      handleRequest(app, req, res);
    });
    attachWebSocket(server, app); // live updates for the mobile apps
    server.listen(config.port, config.host, () => {
      console.log("WoW API ready: http://" + config.host + ":" + config.port + "/v1/health");
    });

    const shutdown = () => {
      app.hub.closeAll();
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(0), 3000).unref();
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  })
  .catch((err) => {
    console.error("Failed to start API:", err);
    process.exit(1);
  });
